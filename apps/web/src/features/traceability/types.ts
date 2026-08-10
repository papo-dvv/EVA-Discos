// Espejo de apps/api/src/traceability: estadísticas de trazabilidad sobre
// pares válidos (es_valido=true) de wear_rate_pairs, filtrables por
// tren/tipoCoche/bogieCodigo combinados libremente (scope), con límites
// calculados SIEMPRE sobre el histórico completo del scope.

export interface TraceabilityScopeParams {
  tren?: number
  tipoCoche?: string
  bogieCodigo?: string
  // Default true en el backend (ver TraceabilityScopeQueryDto) — se manda
  // siempre explícito desde Trazabilidad.tsx (nunca se omite) para que la
  // query key cambie y dispare el refetch correcto al togglear el switch.
  filtrarPorRangoKm?: boolean
}

export type Periodo = '3m' | '6m' | '12m' | '2a' | 'todo'

// 'auto' (default del backend) agrega por mes cuando el tramo pedido supera
// los 100 puntos — ninguno de los 2 gráficos de esta pantalla sabe consumir
// puntos agregados todavía (esperan tasaMensualCruda/estado/valorLimpio por
// punto), así que SIEMPRE se pide 'crudo' explícito (ver Trazabilidad.tsx) y
// nunca se depende del default. Ver el comentario homólogo en
// TraceabilityController (backend) antes de cambiar esto.
export type Agregacion = 'auto' | 'crudo' | 'mensual'

export interface TraceabilitySeriesParams extends TraceabilityScopeParams {
  periodo: Periodo
  agregacion?: Agregacion
}

export interface LimitesMetodo {
  limiteInferior: number
  limiteSuperior: number
  extremoInferior: number
  extremoSuperior: number
}

export interface MetodoDescrito extends LimitesMetodo {
  formula: string
}

export interface RangoConsenso {
  inferior: number
  superior: number
}

export interface ConsensoLimites {
  limiteConsenso: RangoConsenso
  extremoConsenso: RangoConsenso
}

export interface EstadisticasGenerales {
  media: number
  mediana: number
  moda: number
  desviacionEstandar: number
  minimo: number
  maximo: number
  conteo: number
}

export type ClasificacionAsimetria = 'SIMETRICA' | 'SESGO_POSITIVO' | 'SESGO_NEGATIVO'

// Coeficiente de Fisher-Pearson ajustado sobre el mismo dataset limpio que
// `estadisticas` (ver TraceabilityStatsService.calcularAsimetria, backend).
// null solo si el backend no pudo calcularlo (n<3, no debería pasar dado el
// mínimo de 20 pares que ya exige /traceability/summary).
export interface AsimetriaResumen {
  coeficiente: number | null
  clasificacion: ClasificacionAsimetria | null
}

// Promedio calculado APARTE, solo sobre los pares cuyo diferenciaKm cae en
// [kmMinimo, kmMaximo]: ese subconjunto define sus PROPIOS límites (Gauss/
// Percentiles/Tukey -> consenso) y su propio recorte, en vez de heredar el
// consenso del alcance completo — ver el mismo comentario en
// TraceabilityService (backend). Por eso `consenso` acá casi nunca coincide
// con el consenso global del summary.
export interface PromedioRangoKm {
  kmMinimo: number
  kmMaximo: number
  // Pares válidos del alcance con diferenciaKm en el rango — el conjunto CRUDO
  // que alimenta a los 3 métodos de esta card.
  conteo: number
  // false si hay menos de 20 pares en el rango: los límites se calculan igual,
  // pero con tan pocos puntos no tienen valor estadístico y la card lo advierte.
  confiable: boolean
  // null solo si no hay con qué calcular (menos de 2 pares en el rango).
  consenso: ConsensoLimites | null
  // Pares que sobreviven al recorte/exclusión de ESE consenso.
  conteoLimpio: number
  promedio: number | null
}

export interface TraceabilitySummaryInsuficiente {
  datosInsuficientes: true
  conteo: number
}

export interface TraceabilitySummaryResult {
  datosInsuficientes: false
  conteo: number
  gauss: MetodoDescrito
  percentiles: MetodoDescrito
  tukey: MetodoDescrito
  consenso: ConsensoLimites
  estadisticas: EstadisticasGenerales
  promedioRangoKm: PromedioRangoKm
  asimetria: AsimetriaResumen
}

export type TraceabilitySummaryResponse = TraceabilitySummaryInsuficiente | TraceabilitySummaryResult

export type EstadoPuntoTrazabilidad = 'normal' | 'recortado' | 'excluido'

export interface PuntoSerieTrazabilidad {
  fecha: string
  tasaMensualCruda: number
  estado: EstadoPuntoTrazabilidad
  valorLimpio: number | null
}

export interface TraceabilitySeriesInsuficiente {
  datosInsuficientes: true
  conteoTotalHistorico: number
}

// Un punto por mes calendario (agregacionAplicada='mensual'): promedio de
// valorLimpio de los puntos normal/recortado de ese mes — espejo de
// PuntoMensualApi en TraceabilityService (backend). Los excluidos ni se
// cuentan ni entran al promedio.
export interface PuntoMensualTrazabilidad {
  mes: string // YYYY-MM
  promedioValorLimpio: number
  conteoNormal: number
  conteoRecortado: number
}

interface TraceabilitySeriesResultBase {
  datosInsuficientes: false
  gauss: LimitesMetodo
  percentiles: LimitesMetodo
  tukey: LimitesMetodo
  consenso: ConsensoLimites
  conteoTotalHistorico: number
  conteoMostradoEnPeriodo: number
}

export interface TraceabilitySeriesResultCrudo extends TraceabilitySeriesResultBase {
  agregacionAplicada: 'crudo'
  puntos: PuntoSerieTrazabilidad[]
}

export interface TraceabilitySeriesResultMensual extends TraceabilitySeriesResultBase {
  agregacionAplicada: 'mensual'
  puntos: PuntoMensualTrazabilidad[]
}

// Los límites/consenso NUNCA cambian con la agregación — por eso viven en la
// base compartida, no en cada variante (ver el mismo comentario en
// TraceabilityService.obtenerSeries, backend).
export type TraceabilitySeriesResult = TraceabilitySeriesResultCrudo | TraceabilitySeriesResultMensual

export type TraceabilitySeriesResponse = TraceabilitySeriesInsuficiente | TraceabilitySeriesResult

// Promedio de valorLimpio agrupado por tren (o toda la flota si `tren` es
// null) — SIN tipoCoche/bogieCodigo y SIN ningún recorte de km (ni el fijo de
// esta pantalla ni el configurable de Proyección): el scope completo de ese
// tren. Por eso nunca se ve afectado por filtrarPorRangoKm — espejo de
// PromedioPorTren en TraceabilityService (backend).
export interface PromedioPorTren {
  tren: number | null
  conteo: number
  confiable: boolean
  consenso: ConsensoLimites | null
  conteoLimpio: number
  promedio: number | null
}
