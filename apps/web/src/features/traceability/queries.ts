import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { obtenerTraceabilitySeries, obtenerTraceabilitySummary } from './api'
import type { TraceabilityScopeParams, TraceabilitySeriesParams } from './types'

const claves = {
  summary: (scope: TraceabilityScopeParams) => ['traceability', 'summary', scope] as const,
  series: (params: TraceabilitySeriesParams) => ['traceability', 'series', params] as const,
}

// El scope (tren/tipoCoche/bogieCodigo) SÍ recalcula todo en el backend
// (cambia el conjunto de pares) — este query se comporta como cualquier
// otro filtro normal.
export function useTraceabilitySummary(scope: TraceabilityScopeParams) {
  return useQuery({
    queryKey: claves.summary(scope),
    queryFn: () => obtenerTraceabilitySummary(scope),
  })
}

// El periodo, en cambio, NUNCA recalcula límites en el backend (ver
// TraceabilityService.obtenerSeries: siempre agrega sobre el histórico
// completo del scope) — solo recorta qué tramo de puntos viaja en la
// respuesta. keepPreviousData evita el parpadeo de "Cargando…" al cambiar de
// periodo: el gráfico se queda con el render anterior (atenuado vía
// `isFetching`, ver GraficoTrazabilidad) hasta que llega el nuevo tramo.
export function useTraceabilitySeries(params: TraceabilitySeriesParams) {
  return useQuery({
    queryKey: claves.series(params),
    queryFn: () => obtenerTraceabilitySeries(params),
    placeholderData: keepPreviousData,
  })
}
