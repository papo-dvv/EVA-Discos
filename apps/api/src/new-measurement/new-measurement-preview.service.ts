import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type LadoDisco,
  type MeasurementSheet,
  type MeasurementSheetInstrumento,
  type MeasurementSheetTecnico,
  Prisma,
} from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';
import type { PreviewQueryDto } from '../migration/dto/preview-query.dto';
import {
  aPreviewRow,
  buscarScanRecordsPaginado,
  type PreviewResult,
  type PreviewRow,
} from '../scan-records/scan-record-query';
import type { AgregarFilaDto } from './dto/agregar-fila.dto';
import type { UpdateFichaDto } from './dto/update-ficha.dto';
import type { UpdateFilaDto } from './dto/update-fila.dto';
import {
  resolverNumerosCochePorTren,
  validarTrenAlstom,
} from './new-measurement-catalogo';
import {
  MOTIVO_MEDICION,
  resolverIdentidadPorEje,
  resolverRuedaNumero,
} from './new-measurement-csv.parser';
import {
  generarEsqueleto48,
  type PosicionEsqueleto,
} from './new-measurement-esqueleto';
import { NewMeasurementValidationService } from './new-measurement-validation.service';

// kilometraje/kilometrajeOriginalCsv se exponen como number (nunca el
// Prisma.Decimal crudo de MeasurementSheet): un Decimal serializa a STRING en
// JSON (ver Decimal.toJSON de decimal.js), lo que rompería cualquier consumo
// numérico en el frontend — mismo criterio que aPreviewRow (scan-record-query.ts)
// para ScanRecord.kilometraje.
export interface FichaDetalle extends Omit<
  MeasurementSheet,
  'kilometraje' | 'kilometrajeOriginalCsv'
> {
  kilometraje: number;
  kilometrajeOriginalCsv: number | null;
  tecnicos: MeasurementSheetTecnico[];
  instrumentos: MeasurementSheetInstrumento[];
}

export interface PreviewMedicionResult extends PreviewResult {
  ficha: FichaDetalle;
  esqueleto: PosicionEsqueleto[];
}

@Injectable()
export class NewMeasurementPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly validationService: NewMeasurementValidationService,
  ) {}

  async obtenerFicha(fichaId: string): Promise<FichaDetalle> {
    const ficha = await this.cargarFicha(fichaId);
    return this.conDetalle(ficha);
  }

  async obtenerPreview(
    fichaId: string,
    q: PreviewQueryDto,
  ): Promise<PreviewMedicionResult> {
    const ficha = await this.cargarFicha(fichaId);
    const [detalle, preview, numerosCoche] = await Promise.all([
      this.conDetalle(ficha),
      buscarScanRecordsPaginado(
        this.prisma,
        { fileId: this.fileIdDe(ficha) },
        q,
      ),
      this.numerosCochePorFicha(ficha),
    ]);
    return {
      ficha: detalle,
      esqueleto: generarEsqueleto48(numerosCoche),
      ...preview,
    };
  }

  async editarFicha(
    fichaId: string,
    dto: UpdateFichaDto,
    usuarioId: string,
  ): Promise<FichaDetalle> {
    const ficha = await this.cargarFicha(fichaId, { requiereReview: true });

    // Tren/Kilometraje/Fecha son la identidad "congelada" por POST .../lock
    // (ver comentario en MeasurementSheet.tablaBloqueada) — a diferencia de
    // firmas/técnicos/instrumentos/comentarios, que siguen editables después
    // de bloquear la tabla (se completan como cierre de la ficha).
    const tocaHeaderBloqueado =
      dto.trenNumero !== undefined ||
      dto.kilometraje !== undefined ||
      dto.fechaFicha !== undefined;
    if (tocaHeaderBloqueado && ficha.tablaBloqueada) {
      throw new HttpException(
        'La tabla de mediciones está bloqueada: Tren/Fecha/Kilometraje ya no se pueden editar.',
        HttpStatus.LOCKED,
      );
    }

    const cambios: Prisma.MeasurementSheetUpdateInput = {};
    if (dto.trenNumero !== undefined) {
      await validarTrenAlstom(this.prisma, dto.trenNumero);
      cambios.trenNumero = dto.trenNumero;
      cambios.corregidoTren =
        ficha.trenOriginalCsv !== null &&
        dto.trenNumero !== ficha.trenOriginalCsv;
    }
    if (dto.kilometraje !== undefined) {
      cambios.kilometraje = dto.kilometraje;
      cambios.corregidoKilometraje =
        ficha.kilometrajeOriginalCsv !== null &&
        dto.kilometraje !== Number(ficha.kilometrajeOriginalCsv);
    }
    if (dto.fechaFicha !== undefined)
      cambios.fechaFicha = new Date(dto.fechaFicha);
    // Km/Fecha/Tren cambiaron: la validación cruzada (kmInvalido/fechaInvalido)
    // ya calculada queda desactualizada — obliga a un POST .../validate nuevo
    // antes de poder bloquear (ver NewMeasurementValidationService).
    if (tocaHeaderBloqueado) cambios.verificado = false;
    if (dto.todasConformes !== undefined)
      cambios.todasConformes = dto.todasConformes;
    if (dto.comentariosActividad !== undefined)
      cambios.comentariosActividad = dto.comentariosActividad;
    if (dto.responsableMantenimientoNombre !== undefined)
      cambios.responsableMantenimientoNombre =
        dto.responsableMantenimientoNombre;
    if (dto.responsableMantenimientoFirma !== undefined)
      cambios.responsableMantenimientoFirma = dto.responsableMantenimientoFirma;
    if (dto.responsableMantenimientoFecha !== undefined)
      cambios.responsableMantenimientoFecha = new Date(
        dto.responsableMantenimientoFecha,
      );
    if (dto.ingMrNombre !== undefined) cambios.ingMrNombre = dto.ingMrNombre;
    if (dto.ingMrFirma !== undefined) cambios.ingMrFirma = dto.ingMrFirma;
    if (dto.ingMrFecha !== undefined)
      cambios.ingMrFecha = new Date(dto.ingMrFecha);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(cambios).length > 0) {
        await tx.measurementSheet.update({
          where: { id: fichaId },
          data: cambios,
        });
      }
      for (const t of dto.tecnicos ?? []) {
        await tx.measurementSheetTecnico.update({
          where: {
            measurementSheetId_posicion: {
              measurementSheetId: fichaId,
              posicion: t.posicion,
            },
          },
          data: {
            nombre: t.nombre,
            firma: t.firma,
            fecha: t.fecha !== undefined ? new Date(t.fecha) : undefined,
          },
        });
      }
      for (const inst of dto.instrumentos ?? []) {
        await tx.measurementSheetInstrumento.update({
          where: {
            measurementSheetId_posicion: {
              measurementSheetId: fichaId,
              posicion: inst.posicion,
            },
          },
          data: {
            codigo: inst.codigo,
            descripcion: inst.descripcion,
            modeloMarca: inst.modeloMarca,
            fechaCalibracion:
              inst.fechaCalibracion !== undefined
                ? new Date(inst.fechaCalibracion)
                : undefined,
            fechaVencimientoCalibracion:
              inst.fechaVencimientoCalibracion !== undefined
                ? new Date(inst.fechaVencimientoCalibracion)
                : undefined,
            observaciones: inst.observaciones,
          },
        });
      }
      // trenNumero/kilometraje de la ficha son el valor "actual" también para
      // cada fila ya insertada (mismo criterio que migración: la fila guarda
      // su propio trenNumero/kilometraje, no una referencia viva a la ficha).
      if (dto.trenNumero !== undefined || dto.kilometraje !== undefined) {
        await tx.scanRecord.updateMany({
          where: { fileId: this.fileIdDe(ficha) },
          data: {
            ...(dto.trenNumero !== undefined
              ? { trenNumero: dto.trenNumero }
              : {}),
            ...(dto.kilometraje !== undefined
              ? { kilometraje: dto.kilometraje }
              : {}),
          },
        });
      }

      // Una sola entrada de auditoría resumen (no es un ScanRecord, así que
      // scanRecordId queda null — mismo criterio que las correcciones a nivel
      // archivo en migración: ver ScanEditLog.scanRecordId nullable).
      if (
        Object.keys(cambios).length > 0 ||
        dto.tecnicos?.length ||
        dto.instrumentos?.length
      ) {
        const valorAnterior: Record<string, unknown> = {};
        for (const campo of Object.keys(cambios)) {
          valorAnterior[campo] = (ficha as unknown as Record<string, unknown>)[
            campo
          ];
        }
        await tx.scanEditLog.create({
          data: {
            fileId: this.fileIdDe(ficha),
            scanRecordId: null,
            etapa: 'pre_commit',
            campoEditado: 'ficha_editada',
            valorAnterior: JSON.stringify(valorAnterior),
            valorNuevo: JSON.stringify(dto),
            usuarioId,
          },
        });
      }
    });

    return this.obtenerFicha(fichaId);
  }

  async editarFila(
    fichaId: string,
    recordId: string,
    dto: UpdateFilaDto,
    usuarioId: string,
  ): Promise<PreviewRow> {
    const ficha = await this.cargarFicha(fichaId, {
      requiereReview: true,
      requiereDesbloqueada: true,
    });
    const original = await this.prisma.scanRecord.findFirst({
      where: { id: recordId, fileId: this.fileIdDe(ficha) },
    });
    if (!original) {
      throw new NotFoundException('La fila no existe en esta ficha.');
    }

    const cambios: Prisma.ScanRecordUpdateInput = {};
    if (dto.fecha !== undefined) cambios.fecha = new Date(dto.fecha);
    if (dto.observacion !== undefined) cambios.observacion = dto.observacion;

    if (dto.ejeNumero !== undefined || dto.lado !== undefined) {
      const ejeFinal = dto.ejeNumero ?? original.ejeExcel!;
      const ladoFinal = (dto.lado ?? original.ubicacionExcel) as LadoDisco;
      const identidad = resolverIdentidadPorEje(ejeFinal);
      if (!identidad) {
        throw new BadRequestException(
          `Eje fuera de rango (${ejeFinal}, debe ser 1-24).`,
        );
      }
      const duplicado = await this.prisma.scanRecord.findFirst({
        where: {
          fileId: this.fileIdDe(ficha),
          ejeExcel: ejeFinal,
          ubicacionExcel: ladoFinal,
          id: { not: recordId },
        },
      });
      if (duplicado) {
        throw new ConflictException(
          `Ya existe una fila para el eje ${ejeFinal} lado ${ladoFinal} en esta ficha.`,
        );
      }
      const numerosCoche = await this.numerosCochePorFicha(ficha);
      cambios.cocheExcel = identidad.tipoCoche;
      cambios.bogieExcel = identidad.bogieCodigo;
      cambios.ejeExcel = ejeFinal;
      cambios.ubicacionExcel = ladoFinal;
      cambios.ruedaExcel = resolverRuedaNumero(ejeFinal, ladoFinal);
      cambios.numeroCocheExcel = numerosCoche[identidad.tipoCoche] ?? null;
      cambios.ordenFisico = calcularOrdenFisico({
        tipoCoche: identidad.tipoCoche,
        bogieCodigo: identidad.bogieCodigo,
        ejeNumero: ejeFinal,
        ruedaNumero: resolverRuedaNumero(ejeFinal, ladoFinal),
      });
    }

    if (dto.hValue !== undefined || dto.tValue !== undefined) {
      const t = dto.tValue ?? Number(original.tValue);
      const h = dto.hValue ?? Number(original.hValue);
      const evaluador = await this.brakeDiscRules.obtenerEvaluador();
      const rd = evaluador.calcularRd(t, h);
      if (dto.tValue !== undefined) cambios.tValue = dto.tValue;
      if (dto.hValue !== undefined) cambios.hValue = dto.hValue;
      cambios.rdValue = rd;
      cambios.estadoCalculado = evaluador.clasificarEstadoConReperfilado(rd, h);
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.scanRecord.update({
        where: { id: recordId },
        data: cambios,
      });
      await tx.scanEditLog.create({
        data: {
          fileId: this.fileIdDe(ficha),
          scanRecordId: recordId,
          etapa: 'pre_commit',
          campoEditado: 'fila_editada',
          valorAnterior: JSON.stringify({
            hValue: Number(original.hValue),
            tValue: Number(original.tValue),
            ejeExcel: original.ejeExcel,
            ubicacionExcel: original.ubicacionExcel,
          }),
          valorNuevo: JSON.stringify(dto),
          usuarioId,
        },
      });
      // Editar una fila desactualiza la última verificación (ver
      // NewMeasurementValidationService.verificar) — obliga a un nuevo
      // POST .../validate antes de poder bloquear la tabla.
      await tx.measurementSheet.update({
        where: { id: fichaId },
        data: { verificado: false },
      });
      return upd;
    });

    return aPreviewRow(actualizada);
  }

  // Agrega una fila nueva a una ficha en borrador — usado tanto por el modo
  // manual (completar el esqueleto de 48 posiciones de a una) como para
  // sumar un disco que un CSV parcial no trajo.
  async agregarFila(
    fichaId: string,
    dto: AgregarFilaDto,
    usuarioId: string,
  ): Promise<PreviewRow> {
    const ficha = await this.cargarFicha(fichaId, {
      requiereReview: true,
      requiereDesbloqueada: true,
    });
    const identidad = resolverIdentidadPorEje(dto.ejeNumero);
    if (!identidad) {
      throw new BadRequestException(
        `Eje fuera de rango (${dto.ejeNumero}, debe ser 1-24).`,
      );
    }

    const existente = await this.prisma.scanRecord.findFirst({
      where: {
        fileId: this.fileIdDe(ficha),
        ejeExcel: dto.ejeNumero,
        ubicacionExcel: dto.lado,
      },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe una fila para el eje ${dto.ejeNumero} lado ${dto.lado} en esta ficha; usa PATCH para editarla.`,
      );
    }

    const [evaluador, numerosCoche] = await Promise.all([
      this.brakeDiscRules.obtenerEvaluador(),
      this.numerosCochePorFicha(ficha),
    ]);
    const rdValue = evaluador.calcularRd(dto.tValue, dto.hValue);
    const estadoCalculado = evaluador.clasificarEstadoConReperfilado(
      rdValue,
      dto.hValue,
    );
    const ruedaNumero = resolverRuedaNumero(dto.ejeNumero, dto.lado);

    const creada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.scanRecord.create({
        data: {
          fileId: this.fileIdDe(ficha),
          responsableNombre: '',
          trenNumero: ficha.trenNumero,
          kilometraje: ficha.kilometraje,
          fecha: dto.fecha ? new Date(dto.fecha) : ficha.fechaFicha,
          motivo: MOTIVO_MEDICION,
          tValue: dto.tValue,
          hValue: dto.hValue,
          rdValue,
          estadoCalculado,
          cocheExcel: identidad.tipoCoche,
          numeroCocheExcel: numerosCoche[identidad.tipoCoche] ?? null,
          bogieExcel: identidad.bogieCodigo,
          ejeExcel: dto.ejeNumero,
          ubicacionExcel: dto.lado,
          ruedaExcel: ruedaNumero,
          observacion: dto.observacion ?? null,
          ordenFisico: calcularOrdenFisico({
            tipoCoche: identidad.tipoCoche,
            bogieCodigo: identidad.bogieCodigo,
            ejeNumero: dto.ejeNumero,
            ruedaNumero,
          }),
        },
      });
      await tx.scanEditLog.create({
        data: {
          fileId: this.fileIdDe(ficha),
          scanRecordId: fila.id,
          etapa: 'pre_commit',
          campoEditado: 'fila_agregada',
          valorAnterior: null,
          valorNuevo: JSON.stringify({
            eje: dto.ejeNumero,
            lado: dto.lado,
            h: dto.hValue,
            t: dto.tValue,
          }),
          usuarioId,
        },
      });
      // Agregar una fila desactualiza la última verificación, igual que
      // editarFila — ver comentario ahí.
      await tx.measurementSheet.update({
        where: { id: fichaId },
        data: { verificado: false },
      });
      return fila;
    });

    // Validación cruzada automática de ESTA fila recién creada (punto 1 del
    // enunciado, equivalente en modo manual a "al crear la ficha": acá no
    // hay filas hasta que se agregan una por una — ver NewMeasurementService.
    // crearManual). Corre afuera de la transacción de arriba y devuelve la
    // fila ya con los flags persistidos.
    await this.validationService.recalcularFlags(fichaId);
    const conFlags = await this.prisma.scanRecord.findUniqueOrThrow({
      where: { id: creada.id },
    });

    return aPreviewRow(conFlags);
  }

  async eliminarFila(
    fichaId: string,
    recordId: string,
    usuarioId: string,
  ): Promise<{ eliminadas: number }> {
    const ficha = await this.cargarFicha(fichaId, {
      requiereReview: true,
      requiereDesbloqueada: true,
    });
    const fila = await this.prisma.scanRecord.findFirst({
      where: { id: recordId, fileId: this.fileIdDe(ficha) },
    });
    if (!fila) {
      throw new NotFoundException('La fila no existe en esta ficha.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.scanEditLog.create({
        data: {
          fileId: this.fileIdDe(ficha),
          scanRecordId: null,
          etapa: 'pre_commit',
          campoEditado: 'fila_eliminada',
          valorAnterior: JSON.stringify({
            id: fila.id,
            ejeExcel: fila.ejeExcel,
            ubicacionExcel: fila.ubicacionExcel,
            hValue: Number(fila.hValue),
            tValue: Number(fila.tValue),
          }),
          valorNuevo: null,
          usuarioId,
        },
      });
      await tx.scanRecord.delete({ where: { id: recordId } });
      // Eliminar una fila desactualiza la última verificación, igual que
      // editarFila — ver comentario ahí.
      await tx.measurementSheet.update({
        where: { id: fichaId },
        data: { verificado: false },
      });
    });

    return { eliminadas: 1 };
  }

  private async cargarFicha(
    fichaId: string,
    opts?: { requiereReview?: boolean; requiereDesbloqueada?: boolean },
  ): Promise<MeasurementSheet> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }
    if (opts?.requiereReview) {
      const file = ficha.uploadedFileId
        ? await this.prisma.uploadedFile.findUnique({
            where: { id: ficha.uploadedFileId },
          })
        : null;
      if (!file || file.status !== 'review') {
        throw new ConflictException(
          'Esta ficha ya no está en revisión y no puede modificarse.',
        );
      }
    }
    if (opts?.requiereDesbloqueada && ficha.tablaBloqueada) {
      throw new HttpException(
        'La tabla de mediciones está bloqueada y no se puede modificar.',
        HttpStatus.LOCKED,
      );
    }
    return ficha;
  }

  // uploadedFileId siempre está poblado en la práctica (ver comentario en
  // NewMeasurementService.crearManual); esta función centraliza el único
  // punto donde se asume eso, con un error claro si alguna vez no es así.
  private fileIdDe(ficha: MeasurementSheet): string {
    if (!ficha.uploadedFileId) {
      throw new ConflictException('Esta ficha no tiene una carga asociada.');
    }
    return ficha.uploadedFileId;
  }

  private async conDetalle(ficha: MeasurementSheet): Promise<FichaDetalle> {
    const [tecnicos, instrumentos] = await Promise.all([
      this.prisma.measurementSheetTecnico.findMany({
        where: { measurementSheetId: ficha.id },
        orderBy: { posicion: 'asc' },
      }),
      this.prisma.measurementSheetInstrumento.findMany({
        where: { measurementSheetId: ficha.id },
        orderBy: { posicion: 'asc' },
      }),
    ]);
    return {
      ...ficha,
      kilometraje: Number(ficha.kilometraje),
      kilometrajeOriginalCsv:
        ficha.kilometrajeOriginalCsv !== null
          ? Number(ficha.kilometrajeOriginalCsv)
          : null,
      tecnicos,
      instrumentos,
    };
  }

  private async numerosCochePorFicha(ficha: MeasurementSheet) {
    const tren = await this.prisma.train.findUnique({
      where: { numero: ficha.trenNumero },
    });
    if (!tren) return {};
    return resolverNumerosCochePorTren(this.prisma, tren.id);
  }
}
