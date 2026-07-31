import {
  Prisma,
  type EstadoDisco,
  type ScanRecord,
} from '../../generated/prisma';
import type {
  AccionRecomendada,
  LadoAfectado,
} from '../brake-disc-rules/brake-disc-rules.engine';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  ColumnaOrdenable,
  PreviewQueryDto,
} from '../migration/dto/preview-query.dto';

// Construcción de WHERE, paginación, conteo por estado y resumen por tren de
// ScanRecord — compartido entre la vista previa de una migración en curso
// (MigrationPreviewService, acotada por fileId) y la vista permanente de
// mediciones ya confirmadas (ScanRecordsService, acotada por disc_id no nulo).
// Ninguna función de este archivo asume cuál es el "base" WHERE: cada llamador
// pasa el suyo (fileId para migración, disc_id IS NOT NULL para confirmados) y
// el resto de los filtros del PreviewQueryDto se combinan igual en ambos casos.

// Estados posibles de un disco, en el orden en que se reportan en las stats.
const ESTADOS: EstadoDisco[] = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO'];

// Columna pública (frontend) -> campo real de ScanRecord en Prisma.
const CAMPO_ORDEN: Record<ColumnaOrdenable, keyof ScanRecord> = {
  responsable: 'responsableNombre',
  kilometraje: 'kilometraje',
  fecha: 'fecha',
  motivo: 'motivo',
  coche: 'cocheExcel',
  numeroCoche: 'numeroCocheExcel',
  bogie: 'bogieExcel',
  eje: 'ejeExcel',
  rueda: 'ruedaExcel',
  h: 'hValue',
  t: 'tValue',
  rd: 'rdValue',
  estado: 'estadoCalculado',
};

export interface PreviewRow {
  id: string;
  // Nulo en el borrador de una migración (disc_id se resuelve recién al
  // confirmar) — se expone igual porque enriquecerAccionRecomendadaConfirmado
  // (ver accion-recomendada.query.ts) lo necesita para resolver el disco par.
  discId: string | null;
  responsableNombre: string;
  trenNumero: number;
  kilometraje: number;
  fecha: string;
  motivo: string;
  cocheExcel: string | null;
  numeroCocheExcel: number | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ruedaExcel: number | null;
  ubicacionExcel: string | null;
  hValue: number;
  tValue: number;
  rdValue: number;
  estadoCalculado: string | null;
  estadoSugeridoExcel: string | null;
  corregidoPorHoja: boolean;
  trenOriginalExcel: number | null;
  discrepanciaEstadoExcel: boolean;
  hojaExcelOrigen: string | null;
  // Placeholders acá (aPreviewRow es sync y no tiene el contexto del resto de
  // filas del archivo/disco): se completan por enriquecerAccionRecomendadaDraft
  // / enriquecerAccionRecomendadaConfirmado en MigrationPreviewService.obtenerPreview
  // y ScanRecordsService.buscar respectivamente.
  accionRecomendada: AccionRecomendada | null;
  ladoAfectado: LadoAfectado;
}

export interface PreviewResult {
  rows: PreviewRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  // Alias en español que consume el selector de página numérico del frontend.
  // Se mantiene totalPages por compatibilidad con el contrato ya existente.
  totalPaginas: number;
}

export interface ResumenTren {
  tren: number;
  totalFilas: number;
  filasConAdvertencia: number;
}

// Conteo por estado (OK/Seguimiento/Cambio/Crítico) de un subconjunto de filas.
export interface ConteoPorEstado {
  ok: number;
  seguimiento: number;
  cambio: number;
  critico: number;
}

export interface EstadisticasScanRecords {
  // Conteo total del subconjunto base (todo el archivo en migración, o todos
  // los registros confirmados), SIN IMPORTAR filtro ni estado — para la
  // tarjeta de "total de datos" del frontend.
  totalFilasSubidas: number;
  // Conteo sobre TODO el subconjunto base (sin filtros de query).
  total: ConteoPorEstado;
  // Conteo sobre el subconjunto que además matchea los filtros vigentes.
  filtrado: ConteoPorEstado;
}

// Construye el WHERE de Prisma a partir de `base` (el scope obligatorio, ej.
// { fileId } o { discId: { not: null } }) y todos los filtros activos del
// query. El resto de condiciones se combinan entre sí según modoCombinacion:
//   AND -> todas en la misma cláusula AND (la fila cumple todas)
//   OR  -> todas dentro de un único OR (la fila cumple cualquiera)
// `base` siempre queda ANDeado aparte, nunca se mezcla con el modo OR.
export function construirWhereScanRecord(
  base: Prisma.ScanRecordWhereInput,
  q: PreviewQueryDto,
): Prisma.ScanRecordWhereInput {
  const condiciones: Prisma.ScanRecordWhereInput[] = [];

  if (q.tren !== undefined) condiciones.push({ trenNumero: q.tren });

  const search = q.search?.trim();
  if (search) {
    condiciones.push({
      OR: [
        { responsableNombre: { contains: search, mode: 'insensitive' } },
        { motivo: { contains: search, mode: 'insensitive' } },
        { cocheExcel: { contains: search, mode: 'insensitive' } },
        { bogieExcel: { contains: search, mode: 'insensitive' } },
        { ubicacionExcel: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (q.tipoCoche?.length) {
    condiciones.push({ cocheExcel: { in: q.tipoCoche } });
  }
  if (q.bogieCodigo?.length) {
    condiciones.push({ bogieExcel: { in: q.bogieCodigo } });
  }
  if (q.estado?.length) {
    condiciones.push({ estadoCalculado: { in: q.estado } });
  }

  // Un solo control combina las dos "advertencias": corrección por hoja y
  // discrepancia de estado con el Excel.
  if (q.corregidoOAdvertencia === true) {
    condiciones.push({
      OR: [{ corregidoPorHoja: true }, { discrepanciaEstadoExcel: true }],
    });
  } else if (q.corregidoOAdvertencia === false) {
    condiciones.push({
      corregidoPorHoja: false,
      discrepanciaEstadoExcel: false,
    });
  }

  const fecha = rangoFecha(q.fechaDesde, q.fechaHasta);
  if (fecha) condiciones.push({ fecha });

  empujarRango(condiciones, 'kilometraje', q.kilometrajeMin, q.kilometrajeMax);
  empujarRango(condiciones, 'hValue', q.hMin, q.hMax);
  empujarRango(condiciones, 'tValue', q.tMin, q.tMax);
  empujarRango(condiciones, 'rdValue', q.rdMin, q.rdMax);
  empujarRango(condiciones, 'ejeExcel', q.ejeMin, q.ejeMax);
  empujarRango(condiciones, 'ruedaExcel', q.ruedaMin, q.ruedaMax);

  if (condiciones.length === 0) return base;

  return q.modoCombinacion === 'OR'
    ? { ...base, OR: condiciones }
    : { ...base, AND: condiciones };
}

// Orden DEFAULT (sin sortBy explícito del frontend): tren ASC, luego la
// disposición física real de coche/bogie/eje/lado dentro de ese tren (ver
// common/orden-fisico.ts) — nunca alfabético. Un sortBy/sortDir explícito
// tiene prioridad y reemplaza esto por completo (ver más abajo).
const ORDEN_FISICO_DEFECTO: Prisma.ScanRecordOrderByWithRelationInput[] = [
  { trenNumero: 'asc' },
  { ordenFisico: 'asc' },
  { id: 'asc' }, // desempate estable
];

function construirOrderByScanRecord(
  q: PreviewQueryDto,
): Prisma.ScanRecordOrderByWithRelationInput[] {
  return q.sortBy !== undefined
    ? [{ [CAMPO_ORDEN[q.sortBy]]: q.sortDir }, { id: 'asc' }]
    : ORDEN_FISICO_DEFECTO;
}

export async function buscarScanRecordsPaginado(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
  q: PreviewQueryDto,
): Promise<PreviewResult> {
  const where = construirWhereScanRecord(base, q);
  const orderBy = construirOrderByScanRecord(q);

  const [total, records] = await prisma.$transaction([
    prisma.scanRecord.count({ where }),
    prisma.scanRecord.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  return {
    rows: records.map(aPreviewRow),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages,
    totalPaginas: totalPages,
  };
}

// Variante SIN paginar: todas las filas que matchean el resto de filtros, en
// el mismo orden que buscarScanRecordsPaginado. Existe solo para el filtro de
// accionRecomendada (ver paginarFiltrandoPorAccion en accion-recomendada.query.ts)
// — como ese campo no es una columna, hay que enriquecer y filtrar el
// conjunto COMPLETO antes de poder paginar correctamente. No usar para nada
// más: pierde el LIMIT/OFFSET a nivel de base de datos.
export async function buscarScanRecordsSinPaginar(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
  q: PreviewQueryDto,
): Promise<PreviewRow[]> {
  const where = construirWhereScanRecord(base, q);
  const orderBy = construirOrderByScanRecord(q);

  const records = await prisma.scanRecord.findMany({ where, orderBy });
  return records.map(aPreviewRow);
}

// Conteo por estado del subconjunto base y del subconjunto filtrado. Recibe
// los MISMOS query params que la búsqueda paginada para que "filtrado"
// refleje justo lo que el usuario está viendo.
export async function obtenerEstadisticasScanRecords(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
  q: PreviewQueryDto,
): Promise<EstadisticasScanRecords> {
  const whereFiltrado = construirWhereScanRecord(base, q);

  const [totalFilasSubidas, total, filtrado] = await Promise.all([
    prisma.scanRecord.count({ where: base }),
    contarPorEstado(prisma, base),
    contarPorEstado(prisma, whereFiltrado),
  ]);

  return { totalFilasSubidas, total, filtrado };
}

export async function obtenerResumenPorTrenScanRecord(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
): Promise<ResumenTren[]> {
  const totales = await prisma.scanRecord.groupBy({
    by: ['trenNumero'],
    where: base,
    _count: { _all: true },
  });

  const advertencias = await prisma.scanRecord.groupBy({
    by: ['trenNumero'],
    where: {
      ...base,
      OR: [{ corregidoPorHoja: true }, { discrepanciaEstadoExcel: true }],
    },
    _count: { _all: true },
  });

  const mapaAdvertencias = new Map(
    advertencias.map((a) => [a.trenNumero, a._count._all]),
  );

  return totales
    .map((t) => ({
      tren: t.trenNumero,
      totalFilas: t._count._all,
      filasConAdvertencia: mapaAdvertencias.get(t.trenNumero) ?? 0,
    }))
    .sort((a, b) => a.tren - b.tren);
}

async function contarPorEstado(
  prisma: PrismaService,
  where: Prisma.ScanRecordWhereInput,
): Promise<ConteoPorEstado> {
  const grupos = await prisma.scanRecord.groupBy({
    by: ['estadoCalculado'],
    where,
    _count: { _all: true },
  });

  const porEstado = new Map<EstadoDisco, number>(
    grupos
      .filter((g): g is typeof g & { estadoCalculado: EstadoDisco } =>
        ESTADOS.includes(g.estadoCalculado as EstadoDisco),
      )
      .map((g) => [g.estadoCalculado, g._count._all]),
  );

  return {
    ok: porEstado.get('OK') ?? 0,
    seguimiento: porEstado.get('SEGUIMIENTO') ?? 0,
    cambio: porEstado.get('CAMBIO') ?? 0,
    critico: porEstado.get('CRITICO') ?? 0,
  };
}

// Construye un rango de fecha { gte, lte } inclusivo a partir de dos fechas
// ISO opcionales. Devuelve undefined si no vino ninguna.
// Exportada: genérica (no depende de ScanRecord), reutilizada tal cual por
// otros WHERE-builders del mismo estilo (ej. wear-rate-pairs-query.ts, que
// tiene DOS rangos de fecha independientes — fecha1 y fecha2).
export function rangoFecha(
  desde?: string,
  hasta?: string,
): Prisma.DateTimeFilter | undefined {
  const filtro: Prisma.DateTimeFilter = {};
  if (desde) filtro.gte = new Date(desde);
  if (hasta) filtro.lte = new Date(hasta);
  return filtro.gte || filtro.lte ? filtro : undefined;
}

// Empuja una condición de rango numérico { gte, lte } sobre un campo, solo si
// hay al menos un extremo definido. Ignora extremos ausentes.
// Exportada y genérica en el WhereInput (W): el único uso de tipo específico
// de ScanRecord era la firma de `campo`; con W genérico este helper sirve
// igual para Prisma.WearRatePairWhereInput y cualquier otro WhereInput plano.
export function empujarRango<W extends object>(
  condiciones: W[],
  campo: keyof W,
  min?: number,
  max?: number,
): void {
  if (min === undefined && max === undefined) return;
  const rango: { gte?: number; lte?: number } = {};
  if (min !== undefined) rango.gte = min;
  if (max !== undefined) rango.lte = max;
  condiciones.push({ [campo]: rango } as W);
}

export function aPreviewRow(r: ScanRecord): PreviewRow {
  return {
    id: r.id,
    discId: r.discId,
    responsableNombre: r.responsableNombre,
    trenNumero: r.trenNumero,
    kilometraje: Number(r.kilometraje),
    fecha: r.fecha.toISOString().slice(0, 10),
    motivo: r.motivo,
    cocheExcel: r.cocheExcel,
    numeroCocheExcel: r.numeroCocheExcel,
    bogieExcel: r.bogieExcel,
    ejeExcel: r.ejeExcel,
    ruedaExcel: r.ruedaExcel,
    ubicacionExcel: r.ubicacionExcel,
    hValue: Number(r.hValue),
    tValue: Number(r.tValue),
    rdValue: r.rdValue,
    estadoCalculado: r.estadoCalculado,
    estadoSugeridoExcel: r.estadoSugeridoExcel,
    corregidoPorHoja: r.corregidoPorHoja,
    trenOriginalExcel: r.trenOriginalExcel,
    discrepanciaEstadoExcel: r.discrepanciaEstadoExcel,
    hojaExcelOrigen: r.hojaExcelOrigen,
    accionRecomendada: null,
    ladoAfectado: null,
  };
}
