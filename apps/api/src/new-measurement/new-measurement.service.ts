import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { read, utils } from 'xlsx';
import { Prisma, type TipoCoche } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearManualDto } from './dto/crear-manual.dto';
import type { UploadCsvDto } from './dto/upload-csv.dto';
import {
  resolverNumerosCochePorTren,
  validarTrenCatalogo,
  validarTrenAlstom,
} from './new-measurement-catalogo';
import {
  generarEsqueleto48,
  type PosicionEsqueleto,
} from './new-measurement-esqueleto';
import {
  ACTIVIDAD_BAJO_BASTIDOR,
  ACTIVIDAD_TORNO_FOSA,
  MOTIVO_MEDICION,
  MOTIVO_REPERFILADO,
  procesarCsvMedicion,
  type DiscrepanciaRd,
  type FilaMedicionInvalida,
  type FilaNuevaMedicion,
  type MotivoFicha,
} from './new-measurement-csv.parser';
import { NewMeasurementValidationService } from './new-measurement-validation.service';

export interface ResumenCargaMedicion {
  fichaId: string;
  fileId: string;
  trenNumero: number;
  kilometraje: number;
  discosDetectados: number;
  discosValidos: number;
  filasInvalidas: FilaMedicionInvalida[];
  discrepanciasRd: DiscrepanciaRd[];
}

export interface ResumenFichaManual {
  fichaId: string;
  trenNumero: number;
  kilometraje: number;
  esqueleto: PosicionEsqueleto[];
}

export interface ResumenReperfiladoDesdeMedicion {
  fichaId: string;
  sourceFichaId: string;
  reutilizada: boolean;
  filasCopiadas: number;
}

export function validarMotivoImplementado(
  motivo: MotivoFicha | undefined,
): void {
  const resuelto = motivo ?? MOTIVO_MEDICION;
  if (resuelto !== MOTIVO_MEDICION && resuelto !== MOTIVO_REPERFILADO) {
    throw new BadRequestException(
      `Motivo '${resuelto}' no implementado aún.`,
    );
  }
}

@Injectable()
export class NewMeasurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly validationService: NewMeasurementValidationService,
  ) {}

  async subirCsv(
    archivo: Express.Multer.File,
    dto: UploadCsvDto,
    usuarioId: string,
  ): Promise<ResumenCargaMedicion> {
    validarMotivoImplementado(dto.motivo);
    const motivo = dto.motivo ?? MOTIVO_MEDICION;
    if (motivo === MOTIVO_REPERFILADO) {
      throw new BadRequestException(
        'Reperfilado no admite CSV ni Excel; usa registro manual o fotografía.',
      );
    }
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }

    const contenido = this.convertirArchivoATextoTabular(archivo);
    const evaluador = await this.brakeDiscRules.obtenerEvaluador();
    const resultado = procesarCsvMedicion(contenido, evaluador);

    if (resultado.metadata.trenNumero === null) {
      throw new BadRequestException(
        'No se pudo determinar el tren (ID_del_tren) desde el archivo.',
      );
    }
    if (resultado.metadata.kilometraje === null) {
      throw new BadRequestException(
        'No se pudo determinar el Kilometraje desde el archivo.',
      );
    }
    if (resultado.filas.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene mediciones de disco de freno reconocibles (disco_freno_*).',
      );
    }

    const tren = await validarTrenAlstom(
      this.prisma,
      resultado.metadata.trenNumero,
    );
    const numerosCoche = await resolverNumerosCochePorTren(
      this.prisma,
      tren.id,
    );

    const fechaFicha = resultado.filas[0].fecha;
    const fechasHora = resultado.filas
      .map((fila) => this.combinarFechaHora(fila.fecha, fila.measTimeOriginal))
      .filter((fecha): fecha is Date => fecha !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const { fichaId, fileId } = await this.prisma.$transaction(
      async (tx) => {
        const uploadedFile = await tx.uploadedFile.create({
          data: {
            filename: archivo.originalname,
            tipoCarga: 'ficha_medicion_individual',
            uploadedBy: usuarioId,
            status: 'review',
            totalRows: resultado.totalMedicionesLeidas,
            validRows: resultado.filas.length,
            invalidRows: resultado.filasInvalidas.length,
          },
        });

        const ficha = await tx.measurementSheet.create({
          data: {
            uploadedFileId: uploadedFile.id,
            trenNumero: tren.numero,
            kilometraje: resultado.metadata.kilometraje!,
            fechaFicha,
            fechaHoraInicio: fechasHora[0] ?? null,
            fechaHoraFin: fechasHora.at(-1) ?? null,
            actividad: ACTIVIDAD_BAJO_BASTIDOR,
            motivo,
            trenOriginalCsv: tren.numero,
            kilometrajeOriginalCsv: resultado.metadata.kilometraje!,
          },
        });

        await this.crearPlaceholdersFicha(tx, ficha.id);

        const scanRecords = resultado.filas.map((fila) =>
          this.aScanRecordData(
            fila,
            uploadedFile.id,
            tren.numero,
            resultado.metadata.kilometraje!,
            numerosCoche,
            motivo,
          ),
        );
        await tx.scanRecord.createMany({ data: scanRecords });

        return { fichaId: ficha.id, fileId: uploadedFile.id };
      },
      { timeout: 30_000 },
    );

    // Validación cruzada automática (punto 1 del enunciado): corre recién
    // afuera de la transacción de creación, igual criterio que el recálculo
    // de Tasa de Desgaste en NewMeasurementCommitService — no es necesario
    // que la creación de la ficha espere/aborte por esto.
    await this.validationService.recalcularFlags(fichaId);

    return {
      fichaId,
      fileId,
      trenNumero: tren.numero,
      kilometraje: resultado.metadata.kilometraje,
      discosDetectados: resultado.totalMedicionesLeidas,
      discosValidos: resultado.filas.length,
      filasInvalidas: resultado.filasInvalidas,
      discrepanciasRd: resultado.discrepanciasRd,
    };
  }

  private convertirArchivoATextoTabular(archivo: Express.Multer.File): string {
    const nombre = archivo.originalname.toLowerCase();
    if (nombre.endsWith('.csv')) return archivo.buffer.toString('utf-8');

    try {
      const workbook = read(archivo.buffer, {
        type: 'buffer',
        cellDates: true,
        bookVBA: false,
      });
      const primeraHoja = workbook.SheetNames[0];
      if (!primeraHoja) {
        throw new Error('Libro sin hojas');
      }
      // El parser de fichas trabaja con el formato tabular exportado por el
      // equipo. Normalizamos Excel/TSV al mismo texto separado por punto y coma.
      return utils.sheet_to_csv(workbook.Sheets[primeraHoja], {
        FS: ';',
        RS: '\n',
        blankrows: false,
      });
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo como una tabla válida de Excel/CSV.',
      );
    }
  }

  async crearManual(
    dto: CrearManualDto,
    usuarioId: string,
  ): Promise<ResumenFichaManual> {
    validarMotivoImplementado(dto.motivo);
    const motivo = dto.motivo ?? MOTIVO_MEDICION;
    const tren = motivo === MOTIVO_REPERFILADO
      ? await validarTrenCatalogo(this.prisma, dto.trenNumero)
      : await validarTrenAlstom(this.prisma, dto.trenNumero);
    const numerosCoche = await resolverNumerosCochePorTren(
      this.prisma,
      tren.id,
    );
    const fechaFicha = dto.fecha ? new Date(dto.fecha) : new Date();

    const fichaId = await this.prisma.$transaction(async (tx) => {
      // scan_records.file_id es NOT NULL: incluso en modo 100% manual se
      // necesita un UploadedFile "técnico" para agrupar las filas que se
      // vayan agregando (ver POST .../records). measurement_sheet.
      // uploadedFileId igual queda seteado con este id: no hay, en la
      // práctica, ninguna ficha sin file_id — ver comentario en el schema.
      const uploadedFile = await tx.uploadedFile.create({
        data: {
          filename: `${motivo} manual — Tren ${tren.numero}`,
          tipoCarga: 'ficha_medicion_individual',
          uploadedBy: usuarioId,
          status: 'review',
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
        },
      });

      const ficha = await tx.measurementSheet.create({
        data: {
          uploadedFileId: uploadedFile.id,
          trenNumero: tren.numero,
          kilometraje: dto.kilometraje,
          fechaFicha,
          actividad: motivo === MOTIVO_REPERFILADO
            ? `CONTROL DE TRABAJOS EN TORNO FOSA - DISCOS DE FRENO TREN ${tren.modelo === 'ansaldo_mb300' ? 'ANSALDO' : 'ALSTOM'}`
            : ACTIVIDAD_BAJO_BASTIDOR,
          motivo,
        },
      });

      await this.crearPlaceholdersFicha(tx, ficha.id);

      return ficha.id;
    });

    return {
      fichaId,
      trenNumero: tren.numero,
      kilometraje: dto.kilometraje,
      esqueleto: generarEsqueleto48(numerosCoche),
    };
  }

  async crearReperfiladoDesdeMedicion(
    sourceFichaId: string,
    usuarioId: string,
  ): Promise<ResumenReperfiladoDesdeMedicion> {
    const existente = await this.prisma.measurementSheet.findUnique({
      where: { sourceMeasurementSheetId: sourceFichaId },
    });
    if (existente) {
      const filas = existente.uploadedFileId
        ? await this.prisma.scanRecord.count({ where: { fileId: existente.uploadedFileId } })
        : 0;
      return { fichaId: existente.id, sourceFichaId, reutilizada: true, filasCopiadas: filas };
    }

    const origen = await this.prisma.measurementSheet.findUnique({ where: { id: sourceFichaId } });
    if (!origen || origen.motivo !== MOTIVO_MEDICION || !origen.uploadedFileId) {
      throw new BadRequestException('La ficha de origen debe ser una Medición válida.');
    }
    const filasOrigen = await this.prisma.scanRecord.findMany({ where: { fileId: origen.uploadedFileId } });

    const fichaId = await this.prisma.$transaction(async (tx) => {
      const archivo = await tx.uploadedFile.create({
        data: {
          filename: `Reperfilado desde ${sourceFichaId}`,
          tipoCarga: 'ficha_medicion_individual',
          uploadedBy: usuarioId,
          status: 'review',
          totalRows: filasOrigen.length,
          validRows: filasOrigen.length,
          invalidRows: 0,
        },
      });
      const ficha = await tx.measurementSheet.create({
        data: {
          uploadedFileId: archivo.id,
          sourceMeasurementSheetId: sourceFichaId,
          trenNumero: origen.trenNumero,
          kilometraje: origen.kilometraje,
          fechaFicha: origen.fechaFicha,
          actividad: ACTIVIDAD_TORNO_FOSA,
          motivo: MOTIVO_REPERFILADO,
          trenOriginalCsv: origen.trenOriginalCsv,
          kilometrajeOriginalCsv: origen.kilometrajeOriginalCsv,
        },
      });
      await this.crearPlaceholdersFicha(tx, ficha.id);
      if (filasOrigen.length) {
        await tx.scanRecord.createMany({
          data: filasOrigen.map((fila) => ({
            id: randomUUID(),
            fileId: archivo.id,
            responsableNombre: '',
            trenNumero: origen.trenNumero,
            kilometraje: origen.kilometraje,
            fecha: origen.fechaFicha,
            motivo: MOTIVO_REPERFILADO,
            tValue: fila.tValue,
            hValue: fila.hValue,
            rdValue: fila.rdValue,
            estadoCalculado: fila.estadoCalculado,
            cocheExcel: fila.cocheExcel,
            numeroCocheExcel: fila.numeroCocheExcel,
            bogieExcel: fila.bogieExcel,
            ejeExcel: fila.ejeExcel,
            ubicacionExcel: fila.ubicacionExcel,
            ruedaExcel: fila.ruedaExcel,
            observacion: fila.observacion,
            ordenFisico: fila.ordenFisico,
            reperfiladoTAntes: fila.tValue,
            reperfiladoHAntes: fila.hValue,
            reperfiladoCompletado: false,
          })),
        });
      }
      return ficha.id;
    });

    return { fichaId, sourceFichaId, reutilizada: false, filasCopiadas: filasOrigen.length };
  }

  private async crearPlaceholdersFicha(
    tx: Prisma.TransactionClient,
    measurementSheetId: string,
  ): Promise<void> {
    await tx.measurementSheetTecnico.createMany({
      data: Array.from({ length: 4 }, (_, i) => ({
        measurementSheetId,
        posicion: i + 1,
      })),
    });
    await tx.measurementSheetInstrumento.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({
        measurementSheetId,
        posicion: i + 1,
      })),
    });
  }

  // disc_id se deja sin resolver (null): igual que en la migración masiva, se
  // resuelve recién al confirmar (ver NewMeasurementCommitService).
  private aScanRecordData(
    fila: FilaNuevaMedicion,
    fileId: string,
    trenNumero: number,
    kilometraje: number,
    numerosCoche: Partial<Record<TipoCoche, number>>,
    motivo: MotivoFicha = MOTIVO_MEDICION,
  ) {
    return {
      id: randomUUID(),
      fileId,
      responsableNombre: '',
      trenNumero,
      kilometraje,
      fecha: fila.fecha,
      motivo,
      tValue: fila.tValue,
      hValue: fila.hValue,
      rdValue: fila.rdValue,
      estadoCalculado: fila.estadoCalculado,
      cocheExcel: fila.tipoCoche,
      numeroCocheExcel: numerosCoche[fila.tipoCoche] ?? null,
      bogieExcel: fila.bogieCodigo,
      ejeExcel: fila.ejeNumero,
      ubicacionExcel: fila.lado,
      ruedaExcel: fila.ruedaNumero,
      measPointNameOriginal: fila.measPointNameOriginal,
      measTimeOriginal: fila.measTimeOriginal,
      profileLinkOriginal: fila.profileLinkOriginal,
      ordenFisico: calcularOrdenFisico({
        tipoCoche: fila.tipoCoche,
        bogieCodigo: fila.bogieCodigo,
        ejeNumero: fila.ejeNumero,
        ruedaNumero: fila.ruedaNumero,
      }),
      ...(motivo === MOTIVO_REPERFILADO
        ? { rugosidadRa: fila.rdValue, reperfiladoCompletado: false }
        : {}),
    };
  }

  private combinarFechaHora(fecha: Date, hora: string | null): Date | null {
    if (!hora || !/^\d{6}$/.test(hora)) return null;
    const resultado = new Date(fecha);
    resultado.setUTCHours(
      Number(hora.slice(0, 2)),
      Number(hora.slice(2, 4)),
      Number(hora.slice(4, 6)),
      0,
    );
    return resultado;
  }
}
