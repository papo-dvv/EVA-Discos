import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { WearRateService } from '../wear-rate/wear-rate.service';
import type { CambioDiscoDto } from './dto/cambio-disco.dto';

// Motivo reservado (ver MOTIVO_OPCIONES en Reperfilado.tsx, hoy deshabilitado
// con tooltip "Próximamente" para el flujo MANUAL de fichas) — acá se usa
// solo como valor de texto de ScanRecord.motivo, sin habilitar ningún flujo
// manual nuevo. Es semánticamente correcto: la fila no es una medición real.
const MOTIVO_CAMBIO = 'Cambio';

export interface ResultadoCambioDisco {
  operacionId: string;
  discosRemovidos: [string, string];
  discosMontados: [string, string];
}

@Injectable()
export class OperationsCambioDiscoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reglas: BrakeDiscRulesService,
    private readonly wearRate: WearRateService,
  ) {}

  async cambiar(
    dto: CambioDiscoDto,
    usuarioId: string,
  ): Promise<ResultadoCambioDisco> {
    const wagon = await this.prisma.wagonUnit.findUnique({
      where: { numeroCoche: dto.numeroCoche },
      include: { tren: true },
    });
    if (!wagon) {
      throw new NotFoundException(`El coche ${dto.numeroCoche} no existe.`);
    }

    const evaluador = await this.reglas.obtenerEvaluador();
    const operacionId = randomUUID();
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    // Placeholder fijo (ver enunciado): T=7.00, H=0.00 — el sistema no
    // inventa un valor de desgaste real, solo deja el disco visible en
    // Mediciones con la advertencia ScanRecord.esSupuesto hasta que una
    // medición real lo reemplace.
    const rd = evaluador.calcularRd(7, 0);
    const estado = evaluador.clasificarEstadoConReperfilado(rd, 0);

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const [viejoIzq, viejoDer] = await Promise.all([
          tx.brakeDisc.findFirst({
            where: {
              wagonUnitId: wagon.id,
              bogieCodigo: dto.bogieCodigo,
              ejeNumero: dto.ejeNumero,
              lado: 'izquierdo',
              stage: 'en_servicio',
            },
          }),
          tx.brakeDisc.findFirst({
            where: {
              wagonUnitId: wagon.id,
              bogieCodigo: dto.bogieCodigo,
              ejeNumero: dto.ejeNumero,
              lado: 'derecho',
              stage: 'en_servicio',
            },
          }),
        ]);
        if (!viejoIzq || !viejoDer) {
          throw new ConflictException(
            `No se encontraron los 2 discos montados en coche ${dto.numeroCoche}, bogie ${dto.bogieCodigo}, eje ${dto.ejeNumero}.`,
          );
        }

        const [nuevoIzq, nuevoDer] = await Promise.all([
          tx.brakeDisc.findUnique({ where: { id: dto.discoNuevoIzquierdoId } }),
          tx.brakeDisc.findUnique({ where: { id: dto.discoNuevoDerechoId } }),
        ]);
        if (!nuevoIzq || nuevoIzq.stage !== 'taller') {
          throw new BadRequestException(
            'El disco de reemplazo del lado izquierdo no está en Taller.',
          );
        }
        if (!nuevoDer || nuevoDer.stage !== 'taller') {
          throw new BadRequestException(
            'El disco de reemplazo del lado derecho no está en Taller.',
          );
        }

        // Baja: se libera wagonUnitId (la posición queda disponible para la
        // pieza nueva) pero bogieCodigo/ejeNumero/lado NO se limpian — quedan
        // como "última posición conocida" para trazabilidad/Inventario.
        await tx.brakeDisc.update({
          where: { id: viejoIzq.id },
          data: { stage: 'almacen', fase: 'usada', wagonUnitId: null },
        });
        await tx.brakeDisc.update({
          where: { id: viejoDer.id },
          data: { stage: 'almacen', fase: 'usada', wagonUnitId: null },
        });

        // Alta: la pieza nueva toma la posición completa (fase se deja como
        // esté — normalmente 'nueva', o 'usada' si venía de un retiro previo).
        await tx.brakeDisc.update({
          where: { id: nuevoIzq.id },
          data: {
            stage: 'en_servicio',
            wagonUnitId: wagon.id,
            bogieCodigo: dto.bogieCodigo,
            ejeNumero: dto.ejeNumero,
            lado: 'izquierdo',
          },
        });
        await tx.brakeDisc.update({
          where: { id: nuevoDer.id },
          data: {
            stage: 'en_servicio',
            wagonUnitId: wagon.id,
            bogieCodigo: dto.bogieCodigo,
            ejeNumero: dto.ejeNumero,
            lado: 'derecho',
          },
        });

        // UploadedFile "técnico" solo para agrupar las 2 filas sintetizadas
        // (scan_records.file_id es NOT NULL) — mismo criterio que
        // NewMeasurementService.crearManual. status:'committed' directo (sin
        // paso de revisión): la fila debe aparecer YA en Mediciones/Flota con
        // la advertencia esSupuesto, no quedar invisible hasta que alguien la
        // confirme a mano (decisión explícita, ver plan de Operaciones).
        const archivo = await tx.uploadedFile.create({
          data: {
            filename: `Cambio de disco — Tren ${wagon.tren.numero}, coche ${wagon.numeroCoche}, bogie ${dto.bogieCodigo}, eje ${dto.ejeNumero}`,
            tipoCarga: 'ficha_medicion_individual',
            uploadedBy: usuarioId,
            status: 'committed',
            totalRows: 2,
            validRows: 2,
            invalidRows: 0,
          },
        });

        const ultimaMedicionTren = await tx.scanRecord.findFirst({
          where: { trenNumero: wagon.tren.numero },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
          select: { kilometraje: true },
        });
        const kilometraje = ultimaMedicionTren?.kilometraje ?? 0;

        const datosScanBase = {
          fileId: archivo.id,
          responsableNombre: dto.tecnicoNombre,
          trenNumero: wagon.tren.numero,
          kilometraje,
          fecha,
          motivo: MOTIVO_CAMBIO,
          tValue: 7,
          hValue: 0,
          rdValue: rd,
          estadoCalculado: estado,
          esSupuesto: true,
        } satisfies Partial<Prisma.ScanRecordUncheckedCreateInput>;

        const [scanIzq, scanDer] = await Promise.all([
          tx.scanRecord.create({
            data: { ...datosScanBase, discId: nuevoIzq.id },
          }),
          tx.scanRecord.create({
            data: { ...datosScanBase, discId: nuevoDer.id },
          }),
        ]);

        const datosMovimientoBase = {
          operacionId,
          tipo: 'cambio_disco' as const,
          encargadoNombre: dto.tecnicoNombre,
          encargadoFirma: dto.firma ?? null,
          fecha,
          supervisorNombre: dto.supervisorNombre ?? null,
          numeroPt: dto.numeroPt ?? null,
          justificacion: dto.justificacion ?? null,
          realizadoPor: usuarioId,
        };
        await tx.inventoryMovement.createMany({
          data: [
            {
              ...datosMovimientoBase,
              brakeDiscId: viejoIzq.id,
              etapaOrigen: 'en_servicio',
              etapaDestino: 'almacen',
            },
            {
              ...datosMovimientoBase,
              brakeDiscId: viejoDer.id,
              etapaOrigen: 'en_servicio',
              etapaDestino: 'almacen',
            },
            {
              ...datosMovimientoBase,
              brakeDiscId: nuevoIzq.id,
              etapaOrigen: 'taller',
              etapaDestino: 'en_servicio',
              scanRecordId: scanIzq.id,
            },
            {
              ...datosMovimientoBase,
              brakeDiscId: nuevoDer.id,
              etapaOrigen: 'taller',
              etapaDestino: 'en_servicio',
              scanRecordId: scanDer.id,
            },
          ],
        });

        return {
          discosRemovidos: [viejoIzq.id, viejoDer.id] as [string, string],
          discosMontados: [nuevoIzq.id, nuevoDer.id] as [string, string],
        };
      },
      { timeout: 10_000 },
    );

    // Los discos VIEJOS no recibieron ninguna medición nueva (solo cambiaron
    // de etapa) — nada que recalcular para ellos. Solo los nuevos.
    await this.wearRate.recalcularParaDiscos(resultado.discosMontados);

    return { operacionId, ...resultado };
  }
}
