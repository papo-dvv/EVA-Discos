import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ScanRecord } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';
import {
  enriquecerAccionRecomendadaDraft,
  paginarFiltrandoPorAccion,
} from '../scan-records/accion-recomendada.query';
import {
  aPreviewRow,
  buscarScanRecordsPaginado,
  buscarScanRecordsSinPaginar,
  obtenerEstadisticasScanRecords,
  obtenerResumenPorTrenScanRecord,
  type EstadisticasScanRecords,
  type PreviewResult,
  type PreviewRow,
  type ResumenTren,
} from '../scan-records/scan-record-query';
import type { PreviewQueryDto } from './dto/preview-query.dto';
import type { UpdateRowDto } from './dto/update-row.dto';
import { resolverLado } from './migration-excel.parser';

// Campos numéricos, para comparar en la auditoría sin falsos positivos por el
// formato (Decimal "125000.50" vs number 125000.5).
const CAMPOS_NUMERICOS = new Set<string>([
  'kilometraje',
  'hValue',
  'tValue',
  'rdValue',
  'trenNumero',
  'numeroCocheExcel',
  'ejeExcel',
  'ruedaExcel',
]);

export type { PreviewResult, PreviewRow, ResumenTren };

@Injectable()
export class MigrationPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
  ) {}

  async obtenerPreview(
    fileId: string,
    q: PreviewQueryDto,
  ): Promise<PreviewResult> {
    await this.cargarArchivoMigracion(fileId);
    const evaluador = await this.brakeDiscRules.obtenerEvaluador();

    // accionRecomendada nunca es una columna (se calcula cruzando filas del
    // mismo eje) — no hay WHERE posible para ese filtro. Cuando viene, hay
    // que enriquecer TODO el conjunto que matchea el resto de filtros antes
    // de paginar (ver paginarFiltrandoPorAccion); sin ese filtro, se sigue
    // paginando en la base de datos como siempre.
    if (q.accionRecomendada?.length) {
      const filas = await buscarScanRecordsSinPaginar(
        this.prisma,
        { fileId },
        q,
      );
      const enriquecidas = await enriquecerAccionRecomendadaDraft(
        this.prisma,
        fileId,
        filas,
        evaluador,
      );
      const { rows, total, totalPages } = paginarFiltrandoPorAccion(
        enriquecidas,
        (f) => f.accionRecomendada,
        q.accionRecomendada,
        q.page,
        q.pageSize,
      );
      return {
        rows,
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages,
        totalPaginas: totalPages,
      };
    }

    const resultado = await buscarScanRecordsPaginado(
      this.prisma,
      { fileId },
      q,
    );
    resultado.rows = await enriquecerAccionRecomendadaDraft(
      this.prisma,
      fileId,
      resultado.rows,
      evaluador,
    );
    return resultado;
  }

  // Conteo por estado del total de la carga y del subconjunto filtrado. Recibe
  // los MISMOS query params que /preview para que "filtrado" refleje justo lo
  // que el usuario está viendo.
  async obtenerStats(
    fileId: string,
    q: PreviewQueryDto,
  ): Promise<EstadisticasScanRecords> {
    await this.cargarArchivoMigracion(fileId);
    return obtenerEstadisticasScanRecords(this.prisma, { fileId }, q);
  }

  // Valores distintos de Coche y Bogie presentes en la carga, para poblar los
  // multi-selects del panel de filtros del frontend con opciones reales.
  async obtenerOpcionesFiltro(
    fileId: string,
  ): Promise<{ tiposCoche: string[]; bogies: string[] }> {
    await this.cargarArchivoMigracion(fileId);

    const [coches, bogies] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId, cocheExcel: { not: null } },
        distinct: ['cocheExcel'],
        select: { cocheExcel: true },
        orderBy: { cocheExcel: 'asc' },
      }),
      this.prisma.scanRecord.findMany({
        where: { fileId, bogieExcel: { not: null } },
        distinct: ['bogieExcel'],
        select: { bogieExcel: true },
        orderBy: { bogieExcel: 'asc' },
      }),
    ]);

    return {
      tiposCoche: coches
        .map((c) => c.cocheExcel)
        .filter((v): v is string => v !== null),
      bogies: bogies
        .map((b) => b.bogieExcel)
        .filter((v): v is string => v !== null),
    };
  }

  async obtenerResumenPorTren(fileId: string): Promise<ResumenTren[]> {
    await this.cargarArchivoMigracion(fileId);
    return obtenerResumenPorTrenScanRecord(this.prisma, { fileId });
  }

  async editarFila(
    fileId: string,
    rowId: string,
    dto: UpdateRowDto,
    usuarioId: string,
  ): Promise<PreviewRow> {
    await this.cargarArchivoMigracion(fileId, { requiereReview: true });
    const original = await this.prisma.scanRecord.findFirst({
      where: { id: rowId, fileId },
    });
    if (!original) {
      throw new NotFoundException('La fila no existe en esta carga.');
    }

    const cambios: Prisma.ScanRecordUpdateInput = {};
    if (dto.responsableNombre !== undefined)
      cambios.responsableNombre = dto.responsableNombre;
    if (dto.trenNumero !== undefined) cambios.trenNumero = dto.trenNumero;
    if (dto.kilometraje !== undefined) cambios.kilometraje = dto.kilometraje;
    if (dto.fecha !== undefined) cambios.fecha = new Date(dto.fecha);
    if (dto.motivo !== undefined) cambios.motivo = dto.motivo;
    if (dto.hValue !== undefined) cambios.hValue = dto.hValue;
    if (dto.tValue !== undefined) cambios.tValue = dto.tValue;
    if (dto.cocheExcel !== undefined) cambios.cocheExcel = dto.cocheExcel;
    if (dto.numeroCocheExcel !== undefined)
      cambios.numeroCocheExcel = dto.numeroCocheExcel;
    if (dto.bogieExcel !== undefined) cambios.bogieExcel = dto.bogieExcel;
    if (dto.ejeExcel !== undefined) cambios.ejeExcel = dto.ejeExcel;
    if (dto.ubicacionExcel !== undefined)
      cambios.ubicacionExcel = dto.ubicacionExcel;
    if (dto.ruedaExcel !== undefined) cambios.ruedaExcel = dto.ruedaExcel;

    // ordenFisico depende de coche/bogie/eje/lado (nunca de numeroCoche): se
    // recalcula si CUALQUIERA de esos 5 campos cambió, tomando el valor nuevo
    // si vino en el DTO o el ya guardado si no — igual criterio que t/h más
    // abajo para rd/estado.
    if (
      dto.cocheExcel !== undefined ||
      dto.bogieExcel !== undefined ||
      dto.ejeExcel !== undefined ||
      dto.ubicacionExcel !== undefined ||
      dto.ruedaExcel !== undefined
    ) {
      const cocheFinal =
        dto.cocheExcel !== undefined ? dto.cocheExcel : original.cocheExcel;
      const bogieFinal =
        dto.bogieExcel !== undefined ? dto.bogieExcel : original.bogieExcel;
      const ejeFinal =
        dto.ejeExcel !== undefined ? dto.ejeExcel : original.ejeExcel;
      const ubicacionFinal =
        dto.ubicacionExcel !== undefined
          ? dto.ubicacionExcel
          : original.ubicacionExcel;
      const ruedaFinal =
        dto.ruedaExcel !== undefined ? dto.ruedaExcel : original.ruedaExcel;
      cambios.ordenFisico = calcularOrdenFisico({
        tipoCoche: cocheFinal,
        bogieCodigo: bogieFinal,
        ejeNumero: ejeFinal,
        lado: resolverLado(ubicacionFinal, ruedaFinal),
      });
    }

    // El backend SIEMPRE recalcula Rd/estado cuando cambian H o T (fuente única
    // de verdad); nunca se aceptan del cliente.
    if (dto.hValue !== undefined || dto.tValue !== undefined) {
      const t = dto.tValue ?? Number(original.tValue);
      const h = dto.hValue ?? Number(original.hValue);
      const evaluador = await this.brakeDiscRules.obtenerEvaluador();
      const rd = evaluador.calcularRd(t, h);
      cambios.rdValue = rd;
      cambios.estadoCalculado = evaluador.clasificarEstado(rd);
    }

    // Una entrada de auditoría por cada campo que efectivamente cambió (incluye
    // rd_value/estado_calculado si se recalcularon).
    const entradas = this.entradasDeEdicion(
      original,
      cambios,
      rowId,
      fileId,
      usuarioId,
    );

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.scanRecord.update({
        where: { id: rowId },
        data: cambios,
      });
      if (entradas.length > 0) {
        await tx.scanEditLog.createMany({ data: entradas });
      }
      return upd;
    });

    return aPreviewRow(actualizada);
  }

  async eliminarFila(
    fileId: string,
    rowId: string,
    usuarioId: string,
  ): Promise<{ eliminadas: number }> {
    await this.cargarArchivoMigracion(fileId, { requiereReview: true });
    const fila = await this.prisma.scanRecord.findFirst({
      where: { id: rowId, fileId },
    });
    if (!fila) {
      throw new NotFoundException('La fila no existe en esta carga.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.scanEditLog.create({
        data: this.entradaEliminacion(fila, fileId, usuarioId),
      });
      await tx.scanRecord.delete({ where: { id: rowId } });
    });

    return { eliminadas: 1 };
  }

  async eliminarTren(
    fileId: string,
    numeroTren: number,
    usuarioId: string,
  ): Promise<{ eliminadas: number }> {
    await this.cargarArchivoMigracion(fileId, { requiereReview: true });
    const filas = await this.prisma.scanRecord.findMany({
      where: { fileId, trenNumero: numeroTren },
    });
    if (filas.length === 0) {
      throw new NotFoundException('No hay filas para ese tren en esta carga.');
    }

    // Una entrada de auditoría por fila eliminada (acción masiva).
    const entradas = filas.map((fila) =>
      this.entradaEliminacion(fila, fileId, usuarioId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.scanEditLog.createMany({ data: entradas });
      await tx.scanRecord.deleteMany({
        where: { fileId, trenNumero: numeroTren },
      });
    });

    return { eliminadas: filas.length };
  }

  private async cargarArchivoMigracion(
    fileId: string,
    opts?: { requiereReview?: boolean },
  ) {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tipoCarga !== 'migracion_masiva_excel') {
      throw new NotFoundException('Carga de migración no encontrada.');
    }
    if (opts?.requiereReview && file.status !== 'review') {
      throw new ConflictException(
        'Esta carga ya no está en revisión y no puede modificarse.',
      );
    }
    return file;
  }

  private entradasDeEdicion(
    original: ScanRecord,
    cambios: Prisma.ScanRecordUpdateInput,
    rowId: string,
    fileId: string,
    usuarioId: string,
  ): Prisma.ScanEditLogCreateManyInput[] {
    const entradas: Prisma.ScanEditLogCreateManyInput[] = [];
    for (const campo of Object.keys(cambios)) {
      const anterior = comparable(
        campo,
        (original as Record<string, unknown>)[campo],
      );
      const nuevo = comparable(
        campo,
        (cambios as Record<string, unknown>)[campo],
      );
      if (anterior !== nuevo) {
        entradas.push({
          fileId,
          scanRecordId: rowId,
          etapa: 'pre_commit',
          campoEditado: campo,
          valorAnterior: anterior,
          valorNuevo: nuevo,
          usuarioId,
        });
      }
    }
    return entradas;
  }

  private entradaEliminacion(
    fila: ScanRecord,
    fileId: string,
    usuarioId: string,
  ): Prisma.ScanEditLogCreateManyInput {
    // scanRecordId se deja null (la fila se está borrando); el snapshot completo
    // en valorAnterior preserva qué se eliminó, incluido el id original.
    return {
      fileId,
      scanRecordId: null,
      etapa: 'pre_commit',
      campoEditado: 'fila_eliminada',
      valorAnterior: JSON.stringify({
        id: fila.id,
        trenNumero: fila.trenNumero,
        hojaExcelOrigen: fila.hojaExcelOrigen,
        responsableNombre: fila.responsableNombre,
        tValue: Number(fila.tValue),
        hValue: Number(fila.hValue),
        rdValue: fila.rdValue,
        estadoCalculado: fila.estadoCalculado,
      }),
      valorNuevo: null,
      usuarioId,
    };
  }
}

// Convierte a texto los valores de celda posibles (string | number | boolean
// | Date | Prisma.Decimal | null) sin disparar no-base-to-string sobre unknown.
function textoPlano(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string') return valor;
  if (
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object' && 'toString' in valor) {
    return (valor as { toString(): string }).toString(); // Prisma.Decimal, etc.
  }
  return null;
}

// Representación canónica para comparar viejo vs nuevo en la auditoría.
function comparable(campo: string, valor: unknown): string | null {
  const texto = textoPlano(valor);
  if (texto === null) return null;
  if (CAMPOS_NUMERICOS.has(campo)) {
    const n = Number(texto);
    return Number.isFinite(n) ? String(n) : texto;
  }
  return texto;
}
