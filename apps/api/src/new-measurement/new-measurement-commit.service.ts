import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LadoDisco, ScanRecord, TipoCoche } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { WearRateService } from '../wear-rate/wear-rate.service';
import { resolverIdentidadPorEje } from './new-measurement-csv.parser';

export interface ResumenCommitMedicion {
  fichaId: string;
  fileId: string;
  status: string;
  totalFilas: number;
  discosResueltos: number;
}

export interface ResumenCancelacionMedicion {
  fichaId: string;
  cancelado: boolean;
}

export interface ResumenReset {
  fichaId: string;
  // Nuevo uploaded_file "técnico" que reemplaza al anterior (ver reiniciar) —
  // measurement_sheet.uploadedFileId ya apunta acá.
  fileId: string;
  registrosEliminados: number;
}

@Injectable()
export class NewMeasurementCommitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wearRate: WearRateService,
  ) {}

  // Commit de una ficha de medición individual. A diferencia de la migración
  // masiva (miles de filas, requiere 2 fases + lotes por timeout), acá el
  // volumen máximo es 48 filas: alcanza con UNA transacción. El catálogo de
  // discos de la flota Alstom (6-44) ya está 100% sembrado (ver
  // prisma/seed.ts) — nunca se crea WagonUnit/BrakeDisc acá, solo se
  // resuelven por búsqueda; si falta algo es un error real de datos, no un
  // caso esperado.
  async confirmar(
    fichaId: string,
    usuarioId: string,
  ): Promise<ResumenCommitMedicion> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }
    if (!ficha.responsableMantenimientoNombre?.trim()) {
      throw new UnprocessableEntityException(
        'Falta el responsable de mantenimiento — es obligatorio para confirmar la ficha.',
      );
    }
    const puestoIncompleto =
      ficha.motivo === 'Reperfilado'
        ? !ficha.puestoTrabajo?.trim() ||
          !ficha.fechaHoraInicio ||
          !ficha.fechaHoraFin
        : !ficha.ptCodigo?.trim();
    if (puestoIncompleto) {
      throw new UnprocessableEntityException(
        'Faltan datos obligatorios del P.T. para confirmar la ficha.',
      );
    }
    if (!ficha.tablaBloqueada) {
      throw new UnprocessableEntityException(
        'Falta bloquear la tabla de mediciones (POST .../lock) — es obligatorio para confirmar la ficha.',
      );
    }

    const fileId = ficha.uploadedFileId;
    if (!fileId) {
      throw new ConflictException('Esta ficha no tiene una carga asociada.');
    }
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tipoCarga !== 'ficha_medicion_individual') {
      throw new NotFoundException('Carga de la ficha no encontrada.');
    }
    if (file.status === 'committed') {
      throw new ConflictException('Esta ficha ya fue confirmada.');
    }
    if (file.status !== 'review') {
      throw new ConflictException('Esta ficha no está lista para confirmarse.');
    }

    const filas = await this.prisma.scanRecord.findMany({ where: { fileId } });
    if (filas.length === 0) {
      throw new UnprocessableEntityException(
        'La ficha no tiene mediciones para confirmar.',
      );
    }

    const tren = await this.prisma.train.findUnique({
      where: { numero: ficha.trenNumero },
    });
    if (!tren) {
      throw new UnprocessableEntityException(
        `No se pudo confirmar: el tren ${ficha.trenNumero} no existe en el catálogo.`,
      );
    }

    // Modelo binario (ver NewMeasurementValidationService.verificar): no
    // existe un camino de "commit parcial" — tablaBloqueada=true ya implica
    // que la última verificación encontró todoValido=true (ninguna fila con
    // t/rd/km/fecha inválido), así que TODAS las filas de la ficha se
    // confirman siempre, sin filtrar ninguna.
    const discIdPorFila = new Map<string, string>();
    const wagonCache = new Map<string, string>();
    for (const fila of filas) {
      const wagonUnitId = await this.resolverWagonUnitId(
        fila,
        tren.id,
        wagonCache,
      );
      const discId = await this.resolverBrakeDiscId(fila, wagonUnitId);
      discIdPorFila.set(fila.id, discId);
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        filas.map((fila) =>
          tx.scanRecord.update({
            where: { id: fila.id },
            data: {
              discId: discIdPorFila.get(fila.id)!,
              // responsableNombre siempre se crea vacío (ver
              // NewMeasurementService.aScanRecordData y
              // NewMeasurementPreviewService.agregarFila — no hay dueño fijo
              // por fila como en la migración masiva, que sí trae un
              // responsable por fila del Excel): recién acá, al confirmar,
              // se sabe el valor final y validado del responsable de
              // mantenimiento de TODA la ficha, así que se copia a cada fila
              // para que la vista de confirmados (Mediciones) lo muestre.
              responsableNombre: ficha.responsableMantenimientoNombre!,
            },
          }),
        ),
      );
      await tx.uploadedFile.update({
        where: { id: fileId },
        data: { status: 'committed' },
      });
      await tx.scanEditLog.create({
        data: {
          fileId,
          etapa: 'pre_commit',
          campoEditado: 'status_archivo',
          valorAnterior: file.status,
          valorNuevo: 'committed',
          usuarioId,
        },
      });
    });

    // Alimenta Tasa de Desgaste (precomputada) — Trazabilidad y Proyección
    // consultan scan_records directamente y ya ven los registros recién
    // confirmados sin necesidad de ningún paso extra acá.
    await this.wearRate.recalcularParaDiscos(discIdPorFila.values());

    return {
      fichaId,
      fileId,
      status: 'committed',
      totalFilas: filas.length,
      discosResueltos: discIdPorFila.size,
    };
  }

  async cancelar(fichaId: string): Promise<ResumenCancelacionMedicion> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }
    if (ficha.uploadedFileId) {
      const file = await this.prisma.uploadedFile.findUnique({
        where: { id: ficha.uploadedFileId },
      });
      if (file?.status === 'committed') {
        throw new ConflictException(
          'Esta ficha ya fue confirmada y no puede cancelarse.',
        );
      }
    }

    // measurement_sheet_tecnico/instrumento se eliminan en cascada (ver
    // schema); measurement_sheet.uploadedFileId NO es onDelete:Cascade desde
    // uploaded_files (es al revés: la ficha referencia al archivo), así que
    // hay que borrar la ficha y el archivo técnico por separado — el archivo
    // se lleva sus scan_records/scan_edit_log en cascada.
    await this.prisma.$transaction(async (tx) => {
      await tx.measurementSheet.delete({ where: { id: fichaId } });
      if (ficha.uploadedFileId) {
        await tx.uploadedFile.delete({ where: { id: ficha.uploadedFileId } });
      }
    });

    return { fichaId, cancelado: true };
  }

  // "Resubir CSV" / "Reiniciar ficha": vacía la tabla de mediciones actual
  // (borrador CSV o manual, da igual) para que el usuario empiece de nuevo
  // SIN perder el fichaId — a diferencia de cancelar(), que borra la ficha
  // entera. Deja la ficha lista para un nuevo POST .../upload o para
  // completar el esqueleto a mano de nuevo (POST .../records por fila) —
  // ambos flujos ya asumen measurement_sheet.uploadedFileId resuelto y
  // uploadedFile.status='review' (ver NewMeasurementPreviewService.cargarFicha),
  // por eso acá se crea un archivo técnico nuevo en vez de dejarlo en null.
  async reiniciar(fichaId: string, usuarioId: string): Promise<ResumenReset> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }

    const fileIdAnterior = ficha.uploadedFileId;
    if (fileIdAnterior) {
      const file = await this.prisma.uploadedFile.findUnique({
        where: { id: fileIdAnterior },
      });
      if (file?.status === 'committed') {
        throw new ConflictException(
          'Esta ficha ya fue confirmada y no puede reiniciarse.',
        );
      }
    }

    const registrosEliminados = fileIdAnterior
      ? await this.prisma.scanRecord.count({
          where: { fileId: fileIdAnterior },
        })
      : 0;

    const fileId = await this.prisma.$transaction(async (tx) => {
      if (fileIdAnterior) {
        // scan_records se borra explícito (no solo confiando en el ON DELETE
        // CASCADE de uploaded_files -> scan_records, ver schema) para que
        // registrosEliminados sea exacto y el efecto quede documentado acá.
        // El archivo técnico anterior se borra después: se lleva en cascada
        // lo que quede de scan_edit_log de esa carga (ON DELETE CASCADE) y
        // deja measurement_sheet.uploadedFileId en NULL por un instante (ON
        // DELETE SET NULL) hasta el update de abajo, dentro de la MISMA
        // transacción — igual criterio que NewMeasurementCommitService.cancelar.
        await tx.scanRecord.deleteMany({ where: { fileId: fileIdAnterior } });
        await tx.uploadedFile.delete({ where: { id: fileIdAnterior } });
      }

      // Mismo "archivo técnico" que NewMeasurementService.crearManual: incluso
      // en modo CSV, la ficha reiniciada necesita un uploaded_file para que
      // scan_records.file_id (NOT NULL) tenga dónde colgar la próxima carga o
      // fila agregada a mano.
      const nuevoArchivo = await tx.uploadedFile.create({
        data: {
          filename: `Ficha reiniciada — Tren ${ficha.trenNumero}`,
          tipoCarga: 'ficha_medicion_individual',
          uploadedBy: usuarioId,
          status: 'review',
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
        },
      });

      await tx.measurementSheet.update({
        where: { id: fichaId },
        data: {
          uploadedFileId: nuevoArchivo.id,
          verificado: false,
          tablaBloqueada: false,
        },
      });

      await tx.scanEditLog.create({
        data: {
          fileId: nuevoArchivo.id,
          scanRecordId: null,
          etapa: 'pre_commit',
          campoEditado: 'ficha_reiniciada',
          valorAnterior: JSON.stringify({
            fileIdAnterior,
            registrosEliminados,
          }),
          valorNuevo: null,
          usuarioId,
        },
      });

      return nuevoArchivo.id;
    });

    return { fichaId, fileId, registrosEliminados };
  }

  private async resolverWagonUnitId(
    fila: ScanRecord,
    trenId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const tipoCoche = fila.cocheExcel;
    if (!tipoCoche) {
      throw this.errorFila(fila, 'falta el tipo de coche');
    }
    const cacheKey = tipoCoche;
    const cacheado = cache.get(cacheKey);
    if (cacheado) return cacheado;

    const wagon = await this.prisma.wagonUnit.findFirst({
      where: { trenId, tipoCoche: tipoCoche as TipoCoche },
    });
    if (!wagon) {
      throw this.errorFila(
        fila,
        `no se encontró el coche ${tipoCoche} del tren ${fila.trenNumero} en el catálogo`,
      );
    }
    cache.set(cacheKey, wagon.id);
    return wagon.id;
  }

  private async resolverBrakeDiscId(
    fila: ScanRecord,
    wagonUnitId: string,
  ): Promise<string> {
    const bogieCodigo = fila.bogieExcel;
    const ejeNumero = fila.ejeExcel;
    const lado = fila.ubicacionExcel as LadoDisco | null;
    if (!bogieCodigo || ejeNumero === null || !lado) {
      throw this.errorFila(
        fila,
        'identidad de disco incompleta (bogie/eje/lado)',
      );
    }
    const identidad = resolverIdentidadPorEje(ejeNumero);
    if (!identidad || identidad.bogieCodigo !== bogieCodigo) {
      throw this.errorFila(
        fila,
        `combinación eje/bogie inconsistente (eje ${ejeNumero}, bogie ${bogieCodigo})`,
      );
    }

    const disco = await this.prisma.brakeDisc.findUnique({
      where: {
        wagonUnitId_bogieCodigo_ejeNumero_lado: {
          wagonUnitId,
          bogieCodigo,
          ejeNumero,
          lado,
        },
      },
    });
    if (!disco) {
      throw this.errorFila(
        fila,
        `no se encontró el disco físico (bogie ${bogieCodigo}, eje ${ejeNumero}, lado ${lado}) en el catálogo`,
      );
    }
    return disco.id;
  }

  private errorFila(
    fila: ScanRecord,
    detalle: string,
  ): UnprocessableEntityException {
    return new UnprocessableEntityException(
      `No se pudo confirmar la ficha: eje ${fila.ejeExcel ?? '?'} — ${detalle}. No se guardó ningún cambio.`,
    );
  }
}
