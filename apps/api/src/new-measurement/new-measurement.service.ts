import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type TipoCoche } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearManualDto } from './dto/crear-manual.dto';
import type { UploadCsvDto } from './dto/upload-csv.dto';
import {
  resolverNumerosCochePorTren,
  validarTrenAlstom,
} from './new-measurement-catalogo';
import {
  generarEsqueleto48,
  type PosicionEsqueleto,
} from './new-measurement-esqueleto';
import {
  ACTIVIDAD_BAJO_BASTIDOR,
  MOTIVO_MEDICION,
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

// Valida que el motivo pedido sea el único implementado por este módulo.
// Reperfilado y Cambio existen en el enunciado como alcance futuro; se
// reconocen acá SOLO para poder rechazarlos con un mensaje claro en vez de un
// 400 genérico de "valor inválido".
export function validarMotivoImplementado(
  motivo: MotivoFicha | undefined,
): void {
  const resuelto = motivo ?? MOTIVO_MEDICION;
  if (resuelto !== MOTIVO_MEDICION) {
    throw new BadRequestException(
      `Motivo '${resuelto}' no implementado aún. Este módulo solo soporta '${MOTIVO_MEDICION}'.`,
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
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }

    const contenido = archivo.buffer.toString('utf-8');
    const evaluador = await this.brakeDiscRules.obtenerEvaluador();
    const resultado = procesarCsvMedicion(contenido, evaluador);

    if (resultado.metadata.trenNumero === null) {
      throw new BadRequestException(
        'No se pudo determinar el tren (ID_del_tren) desde el CSV.',
      );
    }
    if (resultado.metadata.kilometraje === null) {
      throw new BadRequestException(
        'No se pudo determinar el Kilometraje desde el CSV.',
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
            actividad: ACTIVIDAD_BAJO_BASTIDOR,
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

  async crearManual(
    dto: CrearManualDto,
    usuarioId: string,
  ): Promise<ResumenFichaManual> {
    validarMotivoImplementado(dto.motivo);
    const tren = await validarTrenAlstom(this.prisma, dto.trenNumero);
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
          filename: `Ingreso manual — Tren ${tren.numero}`,
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
          actividad: ACTIVIDAD_BAJO_BASTIDOR,
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
  ) {
    return {
      id: randomUUID(),
      fileId,
      responsableNombre: '',
      trenNumero,
      kilometraje,
      fecha: fila.fecha,
      motivo: MOTIVO_MEDICION,
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
      ordenFisico: calcularOrdenFisico({
        tipoCoche: fila.tipoCoche,
        bogieCodigo: fila.bogieCodigo,
        ejeNumero: fila.ejeNumero,
        ruedaNumero: fila.ruedaNumero,
      }),
    };
  }
}
