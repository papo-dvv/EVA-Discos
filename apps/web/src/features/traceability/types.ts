// Espejo de apps/api/src/traceability: estadísticas de trazabilidad sobre
// pares válidos (es_valido=true) de wear_rate_pairs, filtrables por
// tren/tipoCoche/bogieCodigo combinados libremente (scope), con límites
// calculados SIEMPRE sobre el histórico completo del scope.

export interface TraceabilityScopeParams {
  tren?: number
  tipoCoche?: string
  bogieCodigo?: string
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
