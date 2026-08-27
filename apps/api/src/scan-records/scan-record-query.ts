import {
  Prisma,
  type EstadoDisco,
  type LadoDisco,
  type ScanRecord,
} from '../../generated/prisma';
import { resolverLado } from '../migration/migration-excel.parser';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  ColumnaOrdenable,
  PreviewQueryDto,
} from '../migration/dto/preview-query.dto';
import type { CampoValoresDistintos } from './dto/valores-distintos-query.dto';

// Construcción de WHERE, paginación, conteo por estado y resumen por tren de
// ScanRecord — compartido entre la vista previa de una migración en curso
// (MigrationPreviewService, acotada por fileId) y la vista permanente de
// mediciones ya confirmadas (ScanRecordsService, acotada por disc_id no nulo).
// Ninguna función de este archivo asume cuál es el "base" WHERE: cada llamador
// pasa el suyo (fileId para migración, disc_id IS NOT NULL para confirmados) y
// el resto de los filtros del PreviewQueryDto se combinan igual en ambos casos.

// Estados posibles de un disco, en el orden en que se reportan en las stats.
const ESTADOS: EstadoDisco[] = [
  'OK',
  'SEGUIMIENTO',
  'CAMBIO',
  'CRITICO',
  'REPERFILADO',
];

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

// Campo cuyo flag de validación cruzada automática (NewMeasurementModule)
// quedó en true — ver motivosInvalidosDeFila más abajo.
export type CampoInvalido = 't' | 'rd' | 'kilometraje' | 'fecha' | 'antes';

export interface MotivoInvalido {
  campo: CampoInvalido;
  motivo: string;
}

// Texto legible de cada motivo de exclusión — vive ACÁ (junto a aPreviewRow)
// para que GET .../preview y POST .../validate (NewMeasurementModule)
// devuelvan EXACTAMENTE el mismo texto sin duplicar el catálogo en 2 lugares
// (ver NewMeasurementValidationService.verificar, que reusa este mismo mapa
// para los campos kmInvalido/fechaInvalido a nivel ficha).
export const TEXTO_MOTIVO_INVALIDO: Record<CampoInvalido, string> = {
  kilometraje: 'Kilometraje menor al último registrado para este tren',
  fecha: 'Fecha anterior a la última medición registrada para este tren',
  t: 'Espesor medido (T) debe ser menor al último valor registrado para este disco',
  rd: 'Vida útil (Rd) debe ser menor al último valor registrado para este disco',
  antes:
    'Los valores antes del reperfilado no pueden reflejar menos desgaste que la última medición registrada de este disco',
};

// Traduce los 2 flags booleanos POR FILA (tInvalido/rdInvalido, ver
// ScanRecord) a un array de motivos legibles. kmInvalido/fechaInvalido NO
// entran acá a propósito: son a nivel FICHA/TREN (el mismo valor calculado
// para las ~48 filas de la ficha, ver NewMeasurementValidationService.
// recalcularFlags) — repetir su motivo en cada fila sería puro ruido
// duplicado, así que viajan ÚNICAMENTE a nivel raíz de la respuesta (ver
// ResumenVerificacion.kmInvalido/fechaInvalido). Vacío (nunca null) cuando
// ningún flag por fila está activo — el caso común para filas de migración/
// confirmados normales, que siempre tienen los 2 en false.
export function motivosInvalidosDeFila(f: {
  tInvalido: boolean;
  rdInvalido: boolean;
  antesInvalido?: boolean;
}): MotivoInvalido[] {
  const campos: CampoInvalido[] = [];
  if (f.tInvalido) campos.push('t');
  if (f.rdInvalido) campos.push('rd');
  if (f.antesInvalido) campos.push('antes');
  return campos.map((campo) => ({
    campo,
    motivo: TEXTO_MOTIVO_INVALIDO[campo],
  }));
}

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
  rugosidadRa: number | null;
  reperfiladoTAntes: number | null;
  reperfiladoHAntes: number | null;
  estadoCalculado: string | null;
  estadoSugeridoExcel: string | null;
  corregidoPorHoja: boolean;
  trenOriginalExcel: number | null;
  numeroCocheOriginalExcel: number | null;
  corregidoNumeroCoche: boolean;
  discrepanciaEstadoExcel: boolean;
  hojaExcelOrigen: string | null;
  // Exclusivo de NewMeasurementModule (ver comentario en ScanRecord.observacion
  // del schema) — null en filas de migración/confirmados normales.
  observacion: string | null;
  // Flags de validación cruzada automática POR FILA — exclusivos de
  // NewMeasurementModule (ver ScanRecord.tInvalido/rdInvalido y
  // NewMeasurementValidationService), siempre false en filas de migración/
  // confirmados normales. kmInvalido/fechaInvalido NO se exponen acá: son a
  // nivel FICHA/TREN, no por fila — ver el comentario de motivosInvalidosDeFila
  // más abajo y ResumenVerificacion.kmInvalido/fechaInvalido (a nivel raíz).
  tInvalido: boolean;
  rdInvalido: boolean;
  // Exclusivo de Reperfilado (ver ScanRecord.antesInvalido) — false en
  // filas de Medición/migración/confirmados normales.
  antesInvalido: boolean;
  // Espejo legible de los 3 flags de arriba (ver motivosInvalidosDeFila) —
  // así el frontend puede repintar el motivo de cada fila desde /preview sin
  // tener que volver a llamar a POST .../validate. Vacío cuando los 2 flags
  // están en false (el caso normal fuera de NewMeasurementModule).
  motivos: MotivoInvalido[];
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

// Conteo por estado (OK/Seguimiento/Cambio/Crítico/Reperfilado) de un
// subconjunto de filas.
export interface ConteoPorEstado {
  ok: number;
  seguimiento: number;
  cambio: number;
  critico: number;
  reperfilado: number;
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

  // Un solo control combina las advertencias automáticas de la fila:
  // corrección por hoja, corrección de N° Coche y discrepancia de estado.
  if (q.corregidoOAdvertencia === true) {
    condiciones.push({
      OR: [
        { corregidoPorHoja: true },
        { corregidoNumeroCoche: true },
        { discrepanciaEstadoExcel: true },
      ],
    });
  } else if (q.corregidoOAdvertencia === false) {
    condiciones.push({
      corregidoPorHoja: false,
      corregidoNumeroCoche: false,
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

  // motivo/responsable: texto libre, insensible a mayúsculas — los valores
  // que ofrece el dropdown (GET .../valores-distintos) ya vienen deduplicados
  // por capitalización (ver obtenerValoresDistintos), así que el filtro tiene
  // que matchear cualquier variante de mayúsculas guardada en la fila, no
  // solo la forma canónica que se muestra en la opción.
  if (q.motivo?.length) {
    condiciones.push({ motivo: { in: q.motivo, mode: 'insensitive' } });
  }
  if (q.responsable?.length) {
    condiciones.push({
      responsableNombre: { in: q.responsable, mode: 'insensitive' },
    });
  }

  // lado: ScanRecord no tiene columna propia (ver PreviewQueryDto.lado) — se
  // deriva de ubicacionExcel con el mismo criterio laxo que resolverLado
  // (contains 'izq'/'der', no el texto completo: tolera variantes/typos como
  // "disco_freno_13_izquiero" del Excel real). Sin fallback de paridad de
  // rueda acá (Prisma no expresa aritmética modular en un WHERE) — una fila
  // con ubicacionExcel ausente o irreconocible simplemente no matchea ningún
  // lado, igual que quedaría sin lado resuelto en resolverLado().
  if (q.lado?.length) {
    condiciones.push({
      OR: q.lado.map((lado) => condicionUbicacionPorLado(lado)),
    });
  }

  if (condiciones.length === 0) return base;

  return q.modoCombinacion === 'OR'
    ? { ...base, OR: condiciones }
    : { ...base, AND: condiciones };
}

// 'izq'/'der' como substring, NO la palabra completa — mismo criterio laxo
// que resolverLado (ver migration-excel.parser.ts) para tolerar variantes de
// Ubicación como "disco_freno_N_izquierdo"/"...derecho" e incluso typos.
function condicionUbicacionPorLado(
  lado: LadoDisco,
): Prisma.ScanRecordWhereInput {
  const fragmento = lado === 'izquierdo' ? 'izq' : 'der';
  return { ubicacionExcel: { contains: fragmento, mode: 'insensitive' } };
}

// Orden DEFAULT (sin sortBy explícito del frontend): tren ASC, luego la
// disposición física real de coche/bogie/eje/rueda dentro de ese tren (ver
// common/orden-fisico.ts) — nunca alfabético — y por último fecha ASC como
// desempate cuando dos filas comparten exactamente la misma identidad física
// (mismo disco, mediciones en fechas distintas). Un sortBy/sortDir explícito
// tiene prioridad y reemplaza esto por completo (ver más abajo). Exportado:
// NewMeasurementValidationService.recalcularFlags lo reutiliza tal cual para
// que filasExcluidas de POST .../validate venga en el MISMO orden jerárquico
// que ya usa toda la pantalla — nunca un criterio propio duplicado.
export const ORDEN_FISICO_DEFECTO: Prisma.ScanRecordOrderByWithRelationInput[] =
  [
    { trenNumero: 'asc' },
    { ordenFisico: 'asc' },
    { fecha: 'asc' },
    { id: 'asc' }, // desempate final, estable
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

  // vistaFecha != 'todas' colapsa a 1 fila por disco físico ANTES de paginar
  // (ver colapsarPorVistaFecha) — no es expresable como WHERE/LIMIT de SQL,
  // así que hace falta traer TODO el conjunto filtrado (sin paginar en la
  // base), colapsar en memoria y recién ahí paginar. Mismo patrón que
  // paginarFiltrandoPorAccion (accion-recomendada.query.ts) para
  // accionRecomendada: un cálculo que cruza filas no puede paginarse en SQL.
  if (q.vistaFecha && q.vistaFecha !== 'todas') {
    const todas = await prisma.scanRecord.findMany({ where, orderBy });
    const colapsadas = colapsarPorVistaFecha(todas, q.vistaFecha);

    const total = colapsadas.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const inicio = (q.page - 1) * q.pageSize;
    return {
      rows: colapsadas.slice(inicio, inicio + q.pageSize).map(aPreviewRow),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      totalPaginas: totalPages,
    };
  }

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

// Identidad de disco físico de una fila: discId si ya está resuelto
// (confirmado), o si no la clave cruda pre-commit (numeroCocheExcel + bogie +
// eje + lado derivado de ubicacionExcel/ruedaExcel — mismo criterio que
// claveEjeDraft en accion-recomendada.query.ts, pero incluyendo el lado
// porque acá interesa el DISCO, no el eje completo). null = sin identidad
// física resoluble -> la fila se excluye del colapso (no se puede garantizar
// que sea 1-por-disco si ni siquiera se sabe de qué disco es).
function claveDisco(
  r: Pick<
    ScanRecord,
    | 'discId'
    | 'numeroCocheExcel'
    | 'bogieExcel'
    | 'ejeExcel'
    | 'ubicacionExcel'
    | 'ruedaExcel'
  >,
): string | null {
  if (r.discId) return `d:${r.discId}`;
  const bogie = r.bogieExcel?.trim();
  if (r.numeroCocheExcel === null || !bogie || r.ejeExcel === null) {
    return null;
  }
  const lado = resolverLado(r.ubicacionExcel, r.ruedaExcel);
  if (!lado) return null;
  return `x:${r.numeroCocheExcel}|${bogie}|${r.ejeExcel}|${lado}`;
}

// true si `candidato` debe reemplazar a `actual` como representante de su
// disco: fecha más reciente/antigua según vistaFecha, y ante un empate de
// fecha, mismo desempate que ORDEN_MAS_RECIENTE (kilometraje, luego id) para
// que el resultado sea determinístico.
function ganaPorVistaFecha(
  candidato: ScanRecord,
  actual: ScanRecord,
  vistaFecha: 'ultima' | 'primera',
): boolean {
  const fc = candidato.fecha.getTime();
  const fa = actual.fecha.getTime();
  if (fc !== fa) return vistaFecha === 'ultima' ? fc > fa : fc < fa;

  const kc = Number(candidato.kilometraje);
  const ka = Number(actual.kilometraje);
  if (kc !== ka) return vistaFecha === 'ultima' ? kc > ka : kc < ka;

  return candidato.id > actual.id;
}

// Colapsa `records` a 1 fila por disco físico (ver claveDisco), quedándose
// con la de fecha más reciente ('ultima') o más antigua ('primera') de cada
// uno. El orden relativo del resultado es el de la PRIMERA aparición de cada
// disco en `records` — si `records` ya viene ordenado (por construirOrderByScanRecord),
// el resultado colapsado conserva ese mismo orden físico/columna elegido.
function colapsarPorVistaFecha(
  records: ScanRecord[],
  vistaFecha: 'ultima' | 'primera',
): ScanRecord[] {
  const porDisco = new Map<string, ScanRecord>();
  for (const r of records) {
    const clave = claveDisco(r);
    if (clave === null) continue;

    const actual = porDisco.get(clave);
    if (!actual || ganaPorVistaFecha(r, actual, vistaFecha)) {
      porDisco.set(clave, r);
    }
  }
  return [...porDisco.values()];
}

// Valores distintos de un campo de texto libre (motivo | responsable) dentro
// de `base`, para poblar dropdowns de filtro dinámicamente (ver
// GET /scan-records/valores-distintos y GET /migration/:fileId/valores-distintos).
// Deduplica SIN distinguir mayúsculas/minúsculas — dos filas "Medición" y
// "medición" son el mismo valor para el filtro (ver motivo/responsable en
// construirWhereScanRecord, que matchea con mode:'insensitive' contra
// cualquiera de las dos) — y se queda con la variante lexicográficamente
// menor como forma canónica a mostrar: determinístico, sin inventar un
// "title case" que no necesariamente sea el real.
//
// Selecciona motivo Y responsableNombre siempre (en vez de una key dinámica
// en `select`): con una key computada de tipo unión, la inferencia de
// retorno de Prisma.findMany se rompe (cae a un tipo demasiado amplio, sin
// relación real con ScanRecord). Seleccionar ambos campos fijos es trivial en
// costo (2 columnas de texto) y mantiene el tipo de fila totalmente estático.
export async function obtenerValoresDistintosScanRecord(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
  campo: CampoValoresDistintos,
): Promise<string[]> {
  const filtroNoVacio =
    campo === 'motivo'
      ? { motivo: { not: '' } }
      : { responsableNombre: { not: '' } };

  const filas = await prisma.scanRecord.findMany({
    where: { ...base, ...filtroNoVacio },
    select: { motivo: true, responsableNombre: true },
  });

  const porClave = new Map<string, string>();
  for (const fila of filas) {
    const valor = (
      campo === 'motivo' ? fila.motivo : fila.responsableNombre
    ).trim();
    if (!valor) continue;
    const clave = valor.toLowerCase();
    const actual = porClave.get(clave);
    if (actual === undefined || valor < actual) porClave.set(clave, valor);
  }

  return [...porClave.values()].sort((a, b) => a.localeCompare(b));
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
      OR: [
        { corregidoPorHoja: true },
        { corregidoNumeroCoche: true },
        { discrepanciaEstadoExcel: true },
      ],
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

// Fecha de la medición confirmada más reciente por tren — usada por el
// semáforo "días sin medir" de Mediciones (ver mediciones-semaforo-config).
export async function obtenerFechaUltimaMedicionPorTren(
  prisma: PrismaService,
  base: Prisma.ScanRecordWhereInput,
): Promise<Map<number, Date>> {
  const filas = await prisma.scanRecord.groupBy({
    by: ['trenNumero'],
    where: base,
    _max: { fecha: true },
  });
  return new Map(
    filas
      .filter((f) => f._max.fecha !== null)
      .map((f) => [f.trenNumero, f._max.fecha as Date]),
  );
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
    reperfilado: porEstado.get('REPERFILADO') ?? 0,
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
    rugosidadRa: r.rugosidadRa === null ? null : Number(r.rugosidadRa),
    reperfiladoTAntes:
      r.reperfiladoTAntes === null ? null : Number(r.reperfiladoTAntes),
    reperfiladoHAntes:
      r.reperfiladoHAntes === null ? null : Number(r.reperfiladoHAntes),
    estadoCalculado: r.estadoCalculado,
    estadoSugeridoExcel: r.estadoSugeridoExcel,
    corregidoPorHoja: r.corregidoPorHoja,
    trenOriginalExcel: r.trenOriginalExcel,
    numeroCocheOriginalExcel: r.numeroCocheOriginalExcel,
    corregidoNumeroCoche: r.corregidoNumeroCoche,
    discrepanciaEstadoExcel: r.discrepanciaEstadoExcel,
    hojaExcelOrigen: r.hojaExcelOrigen,
    observacion: r.observacion,
    tInvalido: r.tInvalido,
    rdInvalido: r.rdInvalido,
    antesInvalido: r.antesInvalido,
    motivos: motivosInvalidosDeFila(r),
  };
}
