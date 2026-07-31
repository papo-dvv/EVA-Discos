import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ScanRecord } from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import type { PreviewQueryDto } from '../migration/dto/preview-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  enriquecerAccionRecomendadaConfirmado,
  paginarFiltrandoPorAccion,
} from './accion-recomendada.query';
import type { UpdateScanRecordDto } from './dto/update-scan-record.dto';
import {
  buscarScanRecordsPaginado,
  buscarScanRecordsSinPaginar,
  obtenerEstadisticasScanRecords,
  obtenerResumenPorTrenScanRecord,
  type EstadisticasScanRecords,
  type PreviewResult,
  type ResumenTren,
} from './scan-record-query';

const CAMPOS_NUMERICOS = new Set<string>([
  'kilometraje',
  'hValue',
  'tValue',
  'rdValue',
]);

// Vista permanente de mediciones: SIEMPRE solo registros confirmados
// (disc_id ya resuelto en el commit — ver MigrationCommitService). Las filas
// borrador de una migración en curso (disc_id null) nunca aparecen acá; esa
// es la vista previa de /migration/:fileId/*, un scope completamente aparte.
const SOLO_CONFIRMADOS: Prisma.ScanRecordWhereInput = {
  discId: { not: null },
};

@Injectable()
export class ScanRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
  ) {}

  // --- Vista permanente de mediciones confirmadas (sin scope de archivo) ---

  async buscar(q: PreviewQueryDto): Promise<PreviewResult> {
    const evaluador = await this.brakeDiscRules.obtenerEvaluador();

    // Ver el mismo comentario en MigrationPreviewService.obtenerPreview:
    // accionRecomendada no es una columna, así que con ese filtro activo hay
    // que enriquecer y filtrar TODO el conjunto antes de paginar.
    if (q.accionRecomendada?.length) {
      const filas = await buscarScanRecordsSinPaginar(
        this.prisma,
        SOLO_CONFIRMADOS,
        q,
      );
      const enriquecidas = await enriquecerAccionRecomendadaConfirmado(
        this.prisma,
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
      SOLO_CONFIRMADOS,
      q,
    );
    resultado.rows = await enriquecerAccionRecomendadaConfirmado(
      this.prisma,
      resultado.rows,
      evaluador,
    );
    return resultado;
  }

  async obtenerStats(q: PreviewQueryDto): Promise<EstadisticasScanRecords> {
    return obtenerEstadisticasScanRecords(this.prisma, SOLO_CONFIRMADOS, q);
  }

  async obtenerResumenPorTren(): Promise<ResumenTren[]> {
    return obtenerResumenPorTrenScanRecord(this.prisma, SOLO_CONFIRMADOS);
  }

  // Valores distintos de Coche y Bogie presentes ENTRE LOS CONFIRMADOS, para
  // poblar los multi-selects del panel de filtros de la vista permanente
  // (mismo patrón que MigrationPreviewService.obtenerOpcionesFiltro, sin
  // scope de archivo).
  async obtenerOpcionesFiltro(): Promise<{
    tiposCoche: string[];
    bogies: string[];
  }> {
    const [coches, bogies] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { ...SOLO_CONFIRMADOS, cocheExcel: { not: null } },
        distinct: ['cocheExcel'],
        select: { cocheExcel: true },
        orderBy: { cocheExcel: 'asc' },
      }),
      this.prisma.scanRecord.findMany({
        where: { ...SOLO_CONFIRMADOS, bogieExcel: { not: null } },
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

  // Edición sobre un registro YA confirmado (post-commit). Registra cada campo
  // que cambió en scan_edit_log con etapa 'post_commit'. Recalcula rd/estado si
  // cambian H o T.
  async editar(
    id: string,
    dto: UpdateScanRecordDto,
    usuarioId: string,
  ): Promise<ScanRecord> {
    const original = await this.cargarConfirmado(id);

    const cambios: Prisma.ScanRecordUpdateInput = {};
    if (dto.responsableNombre !== undefined)
      cambios.responsableNombre = dto.responsableNombre;
    if (dto.kilometraje !== undefined) cambios.kilometraje = dto.kilometraje;
    if (dto.fecha !== undefined) cambios.fecha = new Date(dto.fecha);
    if (dto.motivo !== undefined) cambios.motivo = dto.motivo;
    if (dto.hValue !== undefined) cambios.hValue = dto.hValue;
    if (dto.tValue !== undefined) cambios.tValue = dto.tValue;

    if (dto.hValue !== undefined || dto.tValue !== undefined) {
      const t = dto.tValue ?? Number(original.tValue);
      const h = dto.hValue ?? Number(original.hValue);
      const evaluador = await this.brakeDiscRules.obtenerEvaluador();
      const rd = evaluador.calcularRd(t, h);
      cambios.rdValue = rd;
      cambios.estadoCalculado = evaluador.clasificarEstado(rd);
    }

    const entradas = this.entradasDeEdicion(original, cambios, usuarioId);

    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.scanRecord.update({ where: { id }, data: cambios });
      if (entradas.length > 0) {
        await tx.scanEditLog.createMany({ data: entradas });
      }
      return upd;
    });
  }

  // Eliminación de un registro YA confirmado. Deja un snapshot en la auditoría
  // (etapa 'post_commit') antes de borrar.
  async eliminar(
    id: string,
    usuarioId: string,
  ): Promise<{ eliminadas: number }> {
    const fila = await this.cargarConfirmado(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.scanEditLog.create({
        data: {
          fileId: fila.fileId,
          scanRecordId: null,
          etapa: 'post_commit',
          campoEditado: 'fila_eliminada',
          valorAnterior: JSON.stringify({
            id: fila.id,
            discId: fila.discId,
            trenNumero: fila.trenNumero,
            responsableNombre: fila.responsableNombre,
            tValue: Number(fila.tValue),
            hValue: Number(fila.hValue),
            rdValue: fila.rdValue,
            estadoCalculado: fila.estadoCalculado,
          }),
          valorNuevo: null,
          usuarioId,
        },
      });
      await tx.scanRecord.delete({ where: { id } });
    });

    return { eliminadas: 1 };
  }

  // Carga el registro y exige que su archivo esté 'committed': las ediciones
  // pre-commit se hacen por la vista previa de la migración, no por acá.
  private async cargarConfirmado(id: string): Promise<ScanRecord> {
    const fila = await this.prisma.scanRecord.findUnique({
      where: { id },
      include: { file: { select: { status: true } } },
    });
    if (!fila) {
      throw new NotFoundException('El registro no existe.');
    }
    if (fila.file.status !== 'committed') {
      throw new ConflictException(
        'El registro todavía no está confirmado; edítalo desde la vista previa de la migración.',
      );
    }
    return fila;
  }

  private entradasDeEdicion(
    original: ScanRecord,
    cambios: Prisma.ScanRecordUpdateInput,
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
          fileId: original.fileId,
          scanRecordId: original.id,
          etapa: 'post_commit',
          campoEditado: campo,
          valorAnterior: anterior,
          valorNuevo: nuevo,
          usuarioId,
        });
      }
    }
    return entradas;
  }
}

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
    return (valor as { toString(): string }).toString();
  }
  return null;
}

function comparable(campo: string, valor: unknown): string | null {
  const texto = textoPlano(valor);
  if (texto === null) return null;
  if (CAMPOS_NUMERICOS.has(campo)) {
    const n = Number(texto);
    return Number.isFinite(n) ? String(n) : texto;
  }
  return texto;
}
