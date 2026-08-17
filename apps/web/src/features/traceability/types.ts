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
  // Mismo valor que estadisticas.conteo (pares tras recorte/exclusión del
  // consenso), expuesto en la raíz — lo consume GraficoTrazabilidad sin
  // desanidar.
  paresTrasRecorte: number
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

export interface PromedioPorTrenParams {
  // Default true en el backend (ver TraceabilityPromedioPorTrenQueryDto) —
  // igual que TraceabilityScopeParams, se manda siempre explícito.
  filtrarPorRangoKm?: boolean
  // true solo para el modal "ver más" (39 trenes con desglose por tipo de
  // coche) — la card principal (10 primeros) no lo necesita.
  incluirDetalle?: boolean
}

// Mismo desglose que PromedioPorTrenItem pero acotado a un tipoCoche
// específico dentro de un tren — solo viaja si se pidió incluirDetalle=true.
export interface PromedioPorTrenTipoCocheItem {
  tipoCoche: string
  promedio: number | null
  paresTrasRecorte: number
  conteoParesUsados: number
  datosLimitados: boolean
}

// Promedio de valorLimpio de un tren (T06–T44), combinando todo tipoCoche/
// bogie — mismo pipeline que TraceabilitySummaryResult, aplicado tren por
// tren. Siempre se calcula (nunca "datos insuficientes"): con pocos pares el
// promedio igual sale, marcado con datosLimitados — espejo de
// PromedioPorTrenItem en TraceabilityService (backend).
export interface PromedioPorTrenItem {
  tren: number
  promedio: number | null
  paresTrasRecorte: number
  conteoParesUsados: number
  datosLimitados: boolean
  porTipoCoche?: PromedioPorTrenTipoCocheItem[]
}
