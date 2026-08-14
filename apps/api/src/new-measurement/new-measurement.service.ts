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

// Respuesta de POST .../upload cuando el CSV coincide EXACTAMENTE (fecha +
// kilometraje + cada H/T de cada disco presente) con la última ficha
// CONFIRMADA de ese mismo tren — ver NewMeasurementService.buscarDuplicadoExacto.
// La ficha borrador NUNCA se crea en este caso: no existe ningún camino para
// forzar esta carga puntual. El único camino hacia adelante es subir un
// archivo distinto.
export interface ResultadoDuplicadoDetectado {
  duplicadoDetectado: true;
  fichaConfirmadaId: string;
  fecha: string;
  kilometraje: number;
  tren: number;
}

// Tolerancia para comparar H/T contra el histórico confirmado — mismo
// criterio que EPSILON_DISCREPANCIA_RD del parser, evita falsos negativos por
// redondeo de punto flotante entre el valor guardado y el recién parseado.
const EPSILON_COMPARACION_DUPLICADO = 1e-6;
function valoresIguales(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON_COMPARACION_DUPLICADO;
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
  ): Promise<ResumenCargaMedicion | ResultadoDuplicadoDetectado> {
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

    // Detección de duplicado exacto contra la última ficha CONFIRMADA de este
    // mismo tren: un duplicado detectado corta acá, definitivamente — la
    // ficha borrador nunca se crea para este archivo. No existe ningún
    // endpoint/parámetro para forzar esta carga puntual; la única forma de
    // continuar es subir un archivo distinto.
    const duplicado = await this.buscarDuplicadoExacto(
      tren.numero,
      fechaFicha,
      resultado.metadata.kilometraje,
      resultado.filas,
    );
    if (duplicado) {
      return {
        duplicadoDetectado: true,
        fichaConfirmadaId: duplicado.id,
        fecha: fechaFicha.toISOString().slice(0, 10),
        kilometraje: resultado.metadata.kilometraje,
        tren: tren.numero,
      };
    }

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

  // Busca la ficha CONFIRMADA (uploadedFile.status='committed') más reciente
  // de este tren y la compara contra el CSV recién subido: duplicado exacto
  // solo si fecha Y kilometraje coinciden Y cada disco presente en el CSV
  // tiene el mismo H/T que su equivalente confirmado (identidad por eje
  // global + lado, igual que el resto del módulo — ver resolverIdentidadPorEje).
  // Un disco del CSV sin equivalente confirmado (o con H/T distinto) descarta
  // el duplicado de inmediato; discos que la ficha confirmada tenga de más no
  // importan (el enunciado solo exige que los discos PRESENTES coincidan).
  private async buscarDuplicadoExacto(
    trenNumero: number,
    fechaFicha: Date,
    kilometraje: number,
    filas: FilaNuevaMedicion[],
  ): Promise<{ id: string } | null> {
    const ultimaConfirmada = await this.prisma.measurementSheet.findFirst({
      where: { trenNumero, uploadedFile: { status: 'committed' } },
      orderBy: [{ fechaFicha: 'desc' }, { createdAt: 'desc' }],
    });
    if (!ultimaConfirmada?.uploadedFileId) return null;
    if (ultimaConfirmada.fechaFicha.getTime() !== fechaFicha.getTime()) {
      return null;
    }
    if (!valoresIguales(Number(ultimaConfirmada.kilometraje), kilometraje)) {
      return null;
    }

    const confirmados = await this.prisma.scanRecord.findMany({
      where: { fileId: ultimaConfirmada.uploadedFileId },
    });

    const todosCoinciden = filas.every((fila) => {
      const referencia = confirmados.find(
        (r) => r.ejeExcel === fila.ejeNumero && r.ubicacionExcel === fila.lado,
      );
      return (
        referencia !== undefined &&
        valoresIguales(Number(referencia.tValue), fila.tValue) &&
        valoresIguales(Number(referencia.hValue), fila.hValue)
      );
    });

    return todosCoinciden ? { id: ultimaConfirmada.id } : null;
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
