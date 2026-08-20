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
import {
  NewMeasurementHistoryService,
  type FilaSnapshotHistorial,
} from './new-measurement-history.service';
import { NewMeasurementValidationService } from './new-measurement-validation.service';
import {
  actualizarRelacionBogie,
  catalogoRelacionBogies,
  codigosBogiePorTren,
  crearRelacionBogie,
  eliminarRelacionBogie,
  type RelacionBogieCatalogo,
  type RelacionBogieInput,
} from './new-measurement-bogie-codes';

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
  // fichaConfirmadaId: mantiene el nombre histórico, pero con origen
  // 'reinicio' en realidad identifica la ficha que se está reiniciando (ver
  // buscarDuplicadoTrasReinicio), no una ficha confirmada.
  fichaConfirmadaId: string;
  fecha: string;
  kilometraje: number;
  tren: number;
  // 'confirmada': coincide con la última ficha CONFIRMADA de este tren (ver
  // buscarDuplicadoExacto). 'reinicio': coincide con lo que tenía la ficha
  // justo antes de un "Resubir CSV"/"Reiniciar ficha" reciente sobre este
  // mismo tren (ver buscarDuplicadoTrasReinicio) — el frontend ajusta el
  // mensaje del modal según esto.
  origen: 'confirmada' | 'reinicio';
}

// Tolerancia para comparar H/T contra el histórico confirmado — mismo
// criterio que EPSILON_DISCREPANCIA_RD del parser, evita falsos negativos por
// redondeo de punto flotante entre el valor guardado y el recién parseado.
const EPSILON_COMPARACION_DUPLICADO = 1e-6;
function valoresIguales(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON_COMPARACION_DUPLICADO;
}

// Compara cada fila recién parseada contra un set de referencia (confirmado o
// snapshot de historial, según el llamador) por identidad eje+lado — mismo
// criterio en ambos casos: duplicado exacto exige que TODAS las filas nuevas
// tengan un equivalente con igual T/H: filas de referencia "de más" no
// importan.
function filasCoincidenExacto(
  filasNuevas: FilaNuevaMedicion[],
  referencia: {
    ejeExcel: number | null;
    ubicacionExcel: string | null;
    tValue: number;
    hValue: number;
  }[],
): boolean {
  return filasNuevas.every((fila) => {
    const ref = referencia.find(
      (r) => r.ejeExcel === fila.ejeNumero && r.ubicacionExcel === fila.lado,
    );
    return (
      ref !== undefined &&
      valoresIguales(ref.tValue, fila.tValue) &&
      valoresIguales(ref.hValue, fila.hValue)
    );
  });
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

export type RelacionBogieCatalogoConNumeroCoche = RelacionBogieCatalogo & {
  numeroCoche: number | null;
};

// Valida que el motivo pedido sea el único implementado por este módulo.
// Reperfilado y Cambio existen en el enunciado como alcance futuro; se
// reconocen acá SOLO para poder rechazarlos con un mensaje claro en vez de un
// 400 genérico de "valor inválido".
export function validarMotivoImplementado(
  motivo: MotivoFicha | undefined,
): void {
  const resuelto = motivo ?? MOTIVO_MEDICION;
  if (resuelto !== MOTIVO_MEDICION && resuelto !== 'Reperfilado') {
    throw new BadRequestException(`Motivo '${resuelto}' no implementado aún.`);
  }
}

@Injectable()
export class NewMeasurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly validationService: NewMeasurementValidationService,
    private readonly history: NewMeasurementHistoryService,
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
    const duplicadoConfirmado = await this.buscarDuplicadoExacto(
      tren.numero,
      fechaFicha,
      resultado.metadata.kilometraje,
      resultado.filas,
    );
    // Alcance angosto (punto 3 de la ampliación): solo protege la re-subida
    // INMEDIATA tras un "Resubir CSV"/"Reiniciar ficha" — ver
    // buscarDuplicadoTrasReinicio. No se amplía la detección de arriba a
    // cualquier repetición histórica del tren.
    const duplicadoTrasReinicio = duplicadoConfirmado
      ? null
      : await this.buscarDuplicadoTrasReinicio(
          tren.numero,
          fechaFicha,
          resultado.metadata.kilometraje,
          resultado.filas,
        );
    const duplicado = duplicadoConfirmado ?? duplicadoTrasReinicio;
    if (duplicado) {
      await this.history.registrar({
        tipo: 'csv_duplicado_bloqueado',
        trenNumero: tren.numero,
        nombreArchivo: archivo.originalname,
        fechaFicha,
        kilometraje: resultado.metadata.kilometraje,
        usuarioId,
      });
      return {
        duplicadoDetectado: true,
        fichaConfirmadaId: duplicado.id,
        fecha: fechaFicha.toISOString().slice(0, 10),
        kilometraje: resultado.metadata.kilometraje,
        tren: tren.numero,
        origen: duplicadoConfirmado ? 'confirmada' : 'reinicio',
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
            codigosBogie:
              codigosBogiePorTren(tren.numero) ?? Prisma.JsonNull,
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

    await this.history.registrar({
      tipo: 'csv_subido',
      trenNumero: tren.numero,
      fichaId,
      nombreArchivo: archivo.originalname,
      fechaFicha,
      kilometraje: resultado.metadata.kilometraje,
      usuarioId,
    });

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
          actividad:
            dto.motivo === 'Reperfilado'
              ? 'CONTROL DE TRABAJOS EN TORNO FOSA'
              : ACTIVIDAD_BAJO_BASTIDOR,
          motivo: dto.motivo ?? MOTIVO_MEDICION,
          codigosBogie: codigosBogiePorTren(tren.numero) ?? Prisma.JsonNull,
        },
      });

      await this.crearPlaceholdersFicha(tx, ficha.id);

      return ficha.id;
    });

    await this.history.registrar({
      tipo: 'ficha_creada_manual',
      trenNumero: tren.numero,
      fichaId,
      fechaFicha,
      kilometraje: dto.kilometraje,
      usuarioId,
    });

    return {
      fichaId,
      trenNumero: tren.numero,
      kilometraje: dto.kilometraje,
      esqueleto: generarEsqueleto48(numerosCoche),
    };
  }

  async catalogoBogies(): Promise<RelacionBogieCatalogoConNumeroCoche[]> {
    return this.conSeriesCoche(catalogoRelacionBogies());
  }

  async crearRelacionBogie(
    input: RelacionBogieInput,
  ): Promise<RelacionBogieCatalogoConNumeroCoche> {
    try {
      const creada = crearRelacionBogie(input);
      return (await this.conSeriesCoche([creada]))[0]!;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async actualizarRelacionBogie(
    id: string,
    input: RelacionBogieInput,
  ): Promise<RelacionBogieCatalogoConNumeroCoche> {
    try {
      const actualizada = actualizarRelacionBogie(id, input);
      return (await this.conSeriesCoche([actualizada]))[0]!;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  eliminarRelacionBogie(id: string): { eliminada: true } {
    try {
      eliminarRelacionBogie(id);
      return { eliminada: true };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
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
    const referencia = confirmados.map((r) => ({
      ejeExcel: r.ejeExcel,
      ubicacionExcel: r.ubicacionExcel,
      tValue: Number(r.tValue),
      hValue: Number(r.hValue),
    }));

    return filasCoincidenExacto(filas, referencia)
      ? { id: ultimaConfirmada.id }
      : null;
  }

  // Alcance angosto (punto 3 de la ampliación, acordado con el usuario): NO
  // compara contra cualquier intento previo del tren, solo contra el evento
  // MÁS RECIENTE si es justo un ficha_reiniciada — es decir, protege
  // específicamente la re-subida inmediata tras "Resubir CSV"/"Reiniciar
  // ficha". Si el evento más reciente del tren es de otro tipo (ya se subió/
  // confirmó otra cosa desde entonces), no bloquea nada acá — buscarDuplicadoExacto
  // (contra la última confirmada) sigue siendo el único chequeo que aplica.
  // Necesario porque reiniciar() borra los ScanRecord antes de que el usuario
  // elija el nuevo archivo (ver NewMeasurementCommitService.reiniciar) — la
  // única foto de esos datos que sobrevive es snapshotFilas del evento.
  private async buscarDuplicadoTrasReinicio(
    trenNumero: number,
    fechaFicha: Date,
    kilometraje: number,
    filas: FilaNuevaMedicion[],
  ): Promise<{ id: string } | null> {
    const ultimoEvento =
      await this.history.buscarUltimoEventoDeTren(trenNumero);
    if (ultimoEvento?.tipo !== 'ficha_reiniciada') return null;
    if (!ultimoEvento.fechaFicha || ultimoEvento.kilometraje === null)
      return null;
    if (ultimoEvento.fechaFicha.getTime() !== fechaFicha.getTime()) return null;
    if (!valoresIguales(Number(ultimoEvento.kilometraje), kilometraje))
      return null;

    const snapshot = Array.isArray(ultimoEvento.snapshotFilas)
      ? (ultimoEvento.snapshotFilas as unknown as FilaSnapshotHistorial[])
      : null;
    if (!snapshot || snapshot.length === 0) return null;

    const referencia = snapshot.map((f) => ({
      ejeExcel: f.eje,
      ubicacionExcel: f.lado,
      tValue: f.t,
      hValue: f.h,
    }));

    return filasCoincidenExacto(filas, referencia) && ultimoEvento.fichaId
      ? { id: ultimoEvento.fichaId }
      : null;
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
        ? await this.prisma.scanRecord.count({
            where: { fileId: existente.uploadedFileId },
          })
        : 0;
      return {
        fichaId: existente.id,
        sourceFichaId,
        reutilizada: true,
        filasCopiadas: filas,
      };
    }

    const origen = await this.prisma.measurementSheet.findUnique({
      where: { id: sourceFichaId },
    });
    if (
      !origen ||
      origen.motivo !== MOTIVO_MEDICION ||
      !origen.uploadedFileId
    ) {
      throw new BadRequestException(
        'La ficha de origen debe ser una Medición válida.',
      );
    }
    const filasOrigen = await this.prisma.scanRecord.findMany({
      where: { fileId: origen.uploadedFileId },
    });

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
          actividad: 'CONTROL DE TRABAJOS EN TORNO FOSA',
          motivo: 'Reperfilado',
          trenOriginalCsv: origen.trenOriginalCsv,
          kilometrajeOriginalCsv: origen.kilometrajeOriginalCsv,
          codigosBogie:
            (origen.codigosBogie as Prisma.InputJsonValue | null) ??
            codigosBogiePorTren(origen.trenNumero) ??
            Prisma.JsonNull,
        },
      });
      await this.crearPlaceholdersFicha(tx, ficha.id);
      if (filasOrigen.length) {
        await tx.scanRecord.createMany({
          data: filasOrigen.map((fila) => ({
            fileId: archivo.id,
            responsableNombre: fila.responsableNombre,
            trenNumero: fila.trenNumero,
            kilometraje: fila.kilometraje,
            fecha: fila.fecha,
            motivo: 'Reperfilado',
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
          })),
        });
      }
      return ficha.id;
    });

    return {
      fichaId,
      sourceFichaId,
      reutilizada: false,
      filasCopiadas: filasOrigen.length,
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

  private async conSeriesCoche(
    filas: RelacionBogieCatalogo[],
  ): Promise<RelacionBogieCatalogoConNumeroCoche[]> {
    if (filas.length === 0) return [];
    const trenes = await this.prisma.train.findMany({
      where: { numero: { in: [...new Set(filas.map((fila) => fila.trenNumero))] } },
      select: {
        numero: true,
        wagonUnits: { select: { tipoCoche: true, numeroCoche: true } },
      },
    });
    const series = new Map<string, number>();
    for (const tren of trenes) {
      for (const wagon of tren.wagonUnits) {
        series.set(`${tren.numero}:${wagon.tipoCoche}`, wagon.numeroCoche);
      }
    }
    return filas.map((fila) => ({
      ...fila,
      numeroCoche: series.get(`${fila.trenNumero}:${fila.coche}`) ?? null,
    }));
  }
}
