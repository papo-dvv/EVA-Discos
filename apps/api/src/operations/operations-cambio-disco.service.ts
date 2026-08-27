import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LadoDisco, type Prisma } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { resolverRuedaNumero } from '../new-measurement/new-measurement-csv.parser';
import { PrismaService } from '../prisma/prisma.service';
import { WearRateService } from '../wear-rate/wear-rate.service';
import type { AsignacionEjeDto, CambioDiscoDto } from './dto/cambio-disco.dto';

// Motivo reservado (ver MOTIVO_OPCIONES en Reperfilado.tsx, hoy deshabilitado
// con tooltip "Próximamente" para el flujo MANUAL de fichas) — acá se usa
// solo como valor de texto de ScanRecord.motivo, sin habilitar ningún flujo
// manual nuevo. Es semánticamente correcto: la fila no es una medición real.
const MOTIVO_CAMBIO = 'Cambio';

// Hasta 4× el trabajo de un solo eje dentro de la misma transacción — debe
// seguir siendo atómica (una asignación parcial dejaría el tren en un estado
// físicamente inconsistente), así que no se trocea en varias transacciones
// como hace MigrationCommitService; solo se sube el timeout.
const TIMEOUT_TRANSACCION_MS = 20_000;

export interface ResultadoCambioDisco {
  operacionId: string;
  discosRemovidos: string[];
  discosMontados: string[];
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
    this.validarAsignaciones(dto.asignaciones);

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
        // UploadedFile "técnico" compartido por TODAS las asignaciones de
        // esta operación (no uno por eje) — solo agrupa las filas
        // sintetizadas (scan_records.file_id es NOT NULL), mismo criterio
        // que NewMeasurementService.crearManual. status:'committed' directo
        // (sin paso de revisión): las filas deben aparecer YA en
        // Mediciones/Flota con la advertencia esSupuesto.
        const archivo = await tx.uploadedFile.create({
          data: {
            filename: `Cambio de disco — Tren ${wagon.tren.numero}, coche ${wagon.numeroCoche} (${dto.asignaciones.length} eje(s))`,
            tipoCarga: 'ficha_medicion_individual',
            uploadedBy: usuarioId,
            status: 'committed',
            totalRows: dto.asignaciones.length * 2,
            validRows: dto.asignaciones.length * 2,
            invalidRows: 0,
          },
        });

        const ultimaMedicionTren = await tx.scanRecord.findFirst({
          where: { trenNumero: wagon.tren.numero },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
          select: { kilometraje: true },
        });
        const kilometraje = ultimaMedicionTren?.kilometraje ?? 0;

        const discosRemovidos: string[] = [];
        const discosMontados: string[] = [];
        const movimientos: Prisma.InventoryMovementCreateManyInput[] = [];

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

        for (const asignacion of dto.asignaciones) {
          const [viejoIzq, viejoDer] = await Promise.all([
            tx.brakeDisc.findFirst({
              where: {
                wagonUnitId: wagon.id,
                bogieCodigo: asignacion.bogieCodigo,
                ejeNumero: asignacion.ejeNumero,
                lado: 'izquierdo',
                stage: 'en_servicio',
              },
            }),
            tx.brakeDisc.findFirst({
              where: {
                wagonUnitId: wagon.id,
                bogieCodigo: asignacion.bogieCodigo,
                ejeNumero: asignacion.ejeNumero,
                lado: 'derecho',
                stage: 'en_servicio',
              },
            }),
          ]);
          if (!viejoIzq || !viejoDer) {
            throw new ConflictException(
              `No se encontraron los 2 discos montados en coche ${dto.numeroCoche}, bogie ${asignacion.bogieCodigo}, eje ${asignacion.ejeNumero}.`,
            );
          }

          const [nuevoIzq, nuevoDer] = await Promise.all([
            tx.brakeDisc.findUnique({
              where: { id: asignacion.discoNuevoIzquierdoId },
            }),
            tx.brakeDisc.findUnique({
              where: { id: asignacion.discoNuevoDerechoId },
            }),
          ]);
          if (!nuevoIzq || nuevoIzq.stage !== 'taller') {
            throw new BadRequestException(
              `El disco de reemplazo del lado izquierdo del eje ${asignacion.ejeNumero} no está en Taller.`,
            );
          }
          if (!nuevoDer || nuevoDer.stage !== 'taller') {
            throw new BadRequestException(
              `El disco de reemplazo del lado derecho del eje ${asignacion.ejeNumero} no está en Taller.`,
            );
          }

          // Baja: se libera wagonUnitId (la posición queda disponible para
          // la pieza nueva) pero bogieCodigo/ejeNumero/lado NO se limpian —
          // quedan como "última posición conocida" para trazabilidad/Inventario.
          await tx.brakeDisc.update({
            where: { id: viejoIzq.id },
            data: { stage: 'almacen', fase: 'usada', wagonUnitId: null },
          });
          await tx.brakeDisc.update({
            where: { id: viejoDer.id },
            data: { stage: 'almacen', fase: 'usada', wagonUnitId: null },
          });

          // Alta: la pieza nueva toma la posición completa (fase se deja
          // como esté — normalmente 'nueva', o 'usada' si venía de un
          // retiro previo).
          const ruedaIzq = resolverRuedaNumero(
            asignacion.ejeNumero,
            LadoDisco.izquierdo,
          );
          const ruedaDer = resolverRuedaNumero(
            asignacion.ejeNumero,
            LadoDisco.derecho,
          );

          await tx.brakeDisc.update({
            where: { id: nuevoIzq.id },
            data: {
              stage: 'en_servicio',
              wagonUnitId: wagon.id,
              bogieCodigo: asignacion.bogieCodigo,
              ejeNumero: asignacion.ejeNumero,
              lado: 'izquierdo',
              ruedaNumero: ruedaIzq,
            },
          });
          await tx.brakeDisc.update({
            where: { id: nuevoDer.id },
            data: {
              stage: 'en_servicio',
              wagonUnitId: wagon.id,
              bogieCodigo: asignacion.bogieCodigo,
              ejeNumero: asignacion.ejeNumero,
              lado: 'derecho',
              ruedaNumero: ruedaDer,
            },
          });

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
            // Mediciones (scan-record-query.ts) lee la posición SIEMPRE de
            // estos campos denormalizados del propio ScanRecord, nunca de un
            // join a BrakeDisc — sin esto, la fila creada acá era invisible
            // en Coche/N° Coche/Bogie/Eje/Rueda/Lado pese a mostrar Tren
            // correctamente (mismo criterio que NewMeasurementService).
            cocheExcel: wagon.tipoCoche,
            numeroCocheExcel: wagon.numeroCoche,
            bogieExcel: asignacion.bogieCodigo,
            ejeExcel: asignacion.ejeNumero,
          } satisfies Partial<Prisma.ScanRecordUncheckedCreateInput>;

          const [scanIzq, scanDer] = await Promise.all([
            tx.scanRecord.create({
              data: {
                ...datosScanBase,
                discId: nuevoIzq.id,
                ubicacionExcel: 'izquierdo',
                ruedaExcel: ruedaIzq,
                ordenFisico: calcularOrdenFisico({
                  tipoCoche: wagon.tipoCoche,
                  bogieCodigo: asignacion.bogieCodigo,
                  ejeNumero: asignacion.ejeNumero,
                  ruedaNumero: ruedaIzq,
                }),
              },
            }),
            tx.scanRecord.create({
              data: {
                ...datosScanBase,
                discId: nuevoDer.id,
                ubicacionExcel: 'derecho',
                ruedaExcel: ruedaDer,
                ordenFisico: calcularOrdenFisico({
                  tipoCoche: wagon.tipoCoche,
                  bogieCodigo: asignacion.bogieCodigo,
                  ejeNumero: asignacion.ejeNumero,
                  ruedaNumero: ruedaDer,
                }),
              },
            }),
          ]);

          discosRemovidos.push(viejoIzq.id, viejoDer.id);
          discosMontados.push(nuevoIzq.id, nuevoDer.id);
          movimientos.push(
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
          );
        }

        await tx.inventoryMovement.createMany({ data: movimientos });

        return { discosRemovidos, discosMontados };
      },
      { timeout: TIMEOUT_TRANSACCION_MS },
    );

    // Los discos VIEJOS no recibieron ninguna medición nueva (solo cambiaron
    // de etapa) — nada que recalcular para ellos. Solo los nuevos.
    await this.wearRate.recalcularParaDiscos(resultado.discosMontados);

    return { operacionId, ...resultado };
  }

  private validarAsignaciones(asignaciones: AsignacionEjeDto[]): void {
    const clavesEje = new Set(
      asignaciones.map((a) => `${a.bogieCodigo}:${a.ejeNumero}`),
    );
    if (clavesEje.size !== asignaciones.length) {
      throw new BadRequestException(
        'No se puede asignar el mismo eje más de una vez en la misma operación.',
      );
    }

    const discosNuevos = asignaciones.flatMap((a) => [
      a.discoNuevoIzquierdoId,
      a.discoNuevoDerechoId,
    ]);
    if (new Set(discosNuevos).size !== discosNuevos.length) {
      throw new BadRequestException(
        'No se puede usar el mismo disco de reemplazo en más de un eje.',
      );
    }
  }
}
