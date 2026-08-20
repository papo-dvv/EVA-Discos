import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { read } from 'xlsx';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { SISTEMA_USER_ID } from '../common/constants';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  procesarWorkbook,
  type Discrepancia,
  type FilaInvalida,
  type FilaMigracion,
  type HojaConError,
} from './migration-excel.parser';
import { MigrationHistoryService } from './migration-history.service';

export interface ResumenMigracion {
  fileId: string;
  totalHojasProcesadas: number;
  totalFilasLeidas: number;
  filasVaciasOmitidas: number;
  filasValidas: number;
  filasInvalidas: FilaInvalida[];
  filasConAdvertencia: number;
  hojasFaltantes: string[];
  hojasConError: HojaConError[];
  detalleDiscrepancias: Discrepancia[];
}

// Tamaño de lote para los createMany masivos. Con ~22 columnas por ScanRecord,
// 1000 filas => ~22000 bind-params, holgado bajo el límite (~65535) de Postgres.
const LOTE_INSERCION = 1000;

function* enLotes<T>(items: T[], tam: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += tam) {
    yield items.slice(i, i + tam);
  }
}

@Injectable()
export class MigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly history: MigrationHistoryService,
  ) {}

  async procesarUpload(
    archivo: Express.Multer.File,
    usuarioId: string,
  ): Promise<ResumenMigracion> {
    const workbook = this.leerWorkbook(archivo);

    // Umbrales resueltos UNA vez; el motor se reutiliza para todas las filas.
    const evaluador = await this.brakeDiscRules.obtenerEvaluador();
    const resultado = procesarWorkbook(workbook, evaluador);

    if (resultado.hojasProcesadas.length === 0) {
      throw new BadRequestException(
        'No se encontró ninguna tabla legible con las columnas requeridas.',
      );
    }

    const filasConAdvertencia = resultado.filas.filter(
      (fila) =>
        fila.corregidoPorHoja ||
        fila.corregidoNumeroCoche ||
        fila.discrepanciaEstadoExcel,
    ).length;

    // Se generan los id de cada ScanRecord por adelantado para poder enlazar
    // la auditoría de las correcciones automáticas de tren (scanRecordId) sin
    // perder la eficiencia de createMany.
    const registros = resultado.filas.map((fila) => ({
      id: randomUUID(),
      fila,
    }));

    // Correcciones automáticas de tren (la hoja manda): quedan registradas en
    // scan_edit_log con etapa 'pre_commit' y atribuidas al usuario "sistema",
    // porque no las hizo una persona.
    const correccionesTren: Prisma.ScanEditLogCreateManyInput[] = registros
      .filter(({ fila }) => fila.corregidoPorHoja)
      .map(({ id, fila }) => ({
        scanRecordId: id,
        etapa: 'pre_commit',
        campoEditado: 'trenNumero',
        valorAnterior:
          fila.trenOriginalExcel === null
            ? null
            : String(fila.trenOriginalExcel),
        valorNuevo: String(fila.trenNumero),
        usuarioId: SISTEMA_USER_ID,
      }));
    const correccionesNumeroCoche: Prisma.ScanEditLogCreateManyInput[] =
      registros
        .filter(({ fila }) => fila.corregidoNumeroCoche)
        .map(({ id, fila }) => ({
          scanRecordId: id,
          etapa: 'pre_commit',
          campoEditado: 'numeroCocheExcel',
          valorAnterior:
            fila.numeroCocheOriginalExcel === null
              ? null
              : String(fila.numeroCocheOriginalExcel),
          valorNuevo:
            fila.numeroCocheExcel === null
              ? null
              : String(fila.numeroCocheExcel),
          usuarioId: SISTEMA_USER_ID,
        }));

    // UploadedFile + ScanRecords en una transacción: el borrador queda en
    // 'review' para que el Administrador lo revise antes de confirmar.
    // Los createMany se insertan EN LOTES: un archivo real trae ~17k filas y un
    // solo INSERT (filas × ~22 columnas) excede el límite de ~65535 bind-params
    // de Postgres (DriverAdapterError: LengthMismatch). timeout amplio porque la
    // transacción hace varias decenas de inserciones.
    const fileId = await this.prisma.$transaction(
      async (tx) => {
        const uploadedFile = await tx.uploadedFile.create({
          data: {
            filename: archivo.originalname,
            tipoCarga: 'migracion_masiva_excel',
            uploadedBy: usuarioId,
            status: 'review',
            // Las filas vacías (fantasma) no cuentan como leídas para el archivo:
            // no son ni válidas ni inválidas, son ruido de formato de Excel.
            totalRows: resultado.totalFilasLeidas,
            validRows: resultado.filas.length,
            invalidRows: resultado.filasInvalidas.length,
          },
        });

        const scanRecords = registros.map(({ id, fila }) => ({
          id,
          ...this.aScanRecord(fila, uploadedFile.id),
        }));
        for (const lote of enLotes(scanRecords, LOTE_INSERCION)) {
          await tx.scanRecord.createMany({ data: lote });
        }

        const editLogs = [...correccionesTren, ...correccionesNumeroCoche].map(
          (entrada) => ({
            ...entrada,
            fileId: uploadedFile.id,
          }),
        );
        for (const lote of enLotes(editLogs, LOTE_INSERCION)) {
          await tx.scanEditLog.createMany({ data: lote });
        }

        await this.history.registrar(
          {
            tipo: 'migracion_subida',
            fileId: uploadedFile.id,
            nombreArchivo: archivo.originalname,
            alcance: 'marca',
            marca: 'ALSTOM',
            totalFilas: resultado.totalFilasLeidas,
            filasValidas: resultado.filas.length,
            filasInvalidas: resultado.filasInvalidas.length,
            usuarioId,
          },
          tx,
        );

        return uploadedFile.id;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    return {
      fileId,
      totalHojasProcesadas: resultado.hojasProcesadas.length,
      totalFilasLeidas: resultado.totalFilasLeidas,
      filasVaciasOmitidas: resultado.filasVaciasOmitidas,
      filasValidas: resultado.filas.length,
      filasInvalidas: resultado.filasInvalidas,
      filasConAdvertencia,
      hojasFaltantes: resultado.hojasFaltantes,
      hojasConError: resultado.hojasConError,
      detalleDiscrepancias: resultado.detalleDiscrepancias,
    };
  }

  private leerWorkbook(archivo: Express.Multer.File) {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    try {
      // cellDates: las celdas de fecha llegan como Date, no como serial de Excel.
      // bookVBA:false: se ignora el vbaProject.bin (macros) desde la lectura. Solo
      // se leen valores de celda con la API de SheetJS —que nunca ejecuta VBA—;
      // no se usa ningún motor de Excel real (LibreOffice/COM) en ningún paso.
      return read(archivo.buffer, {
        type: 'buffer',
        cellDates: true,
        bookVBA: false,
      });
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo como una tabla válida.',
      );
    }
  }

  // disc_id se deja sin resolver (null) a propósito: la identidad cruda del
  // disco (coche/bogie/eje/...) queda guardada para resolver el disco físico
  // recién al confirmar la carga, en un prompt posterior.
  private aScanRecord(fila: FilaMigracion, fileId: string) {
    return {
      fileId,
      responsableNombre: fila.responsableNombre,
      trenNumero: fila.trenNumero,
      kilometraje: fila.kilometraje,
      fecha: fila.fecha,
      motivo: fila.motivo,
      tValue: fila.tValue,
      hValue: fila.hValue,
      rdValue: fila.rdValue,
      estadoCalculado: fila.estadoCalculado,
      estadoSugeridoExcel: fila.estadoSugeridoExcel,
      hojaExcelOrigen: fila.hojaExcelOrigen,
      trenOriginalExcel: fila.trenOriginalExcel,
      corregidoPorHoja: fila.corregidoPorHoja,
      numeroCocheOriginalExcel: fila.numeroCocheOriginalExcel,
      corregidoNumeroCoche: fila.corregidoNumeroCoche,
      discrepanciaEstadoExcel: fila.discrepanciaEstadoExcel,
      cocheExcel: fila.cocheExcel,
      numeroCocheExcel: fila.numeroCocheExcel,
      bogieExcel: fila.bogieExcel,
      ejeExcel: fila.ejeExcel,
      ubicacionExcel: fila.ubicacionExcel,
      ruedaExcel: fila.ruedaExcel,
      ordenFisico: fila.ordenFisico,
    };
  }
}
