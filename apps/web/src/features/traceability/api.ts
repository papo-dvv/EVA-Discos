import { apiClient } from '../../lib/apiClient'
import type {
  PromedioPorTrenItem,
  PromedioPorTrenParams,
  PuntoTasaPorTipoCoche,
  TraceabilityScopeParams,
  TraceabilitySeriesParams,
  TraceabilitySeriesResponse,
  TraceabilitySummaryResponse,
} from './types'

export async function obtenerTraceabilitySummary(
  params: TraceabilityScopeParams,
): Promise<TraceabilitySummaryResponse> {
  const { data } = await apiClient.get<TraceabilitySummaryResponse>('/traceability/summary', { params })
  return data
}

export async function obtenerTraceabilitySeries(
  params: TraceabilitySeriesParams,
): Promise<TraceabilitySeriesResponse> {
  const { data } = await apiClient.get<TraceabilitySeriesResponse>('/traceability/series', { params })
  return data
}

export async function obtenerPromedioPorTren(
  params: PromedioPorTrenParams,
): Promise<PromedioPorTrenItem[]> {
  const { data } = await apiClient.get<PromedioPorTrenItem[]>('/traceability/promedio-por-tren', { params })
  return data
}

export async function obtenerTraceabilitySeriesPorTipoCoche(): Promise<PuntoTasaPorTipoCoche[]> {
  const { data } = await apiClient.get<PuntoTasaPorTipoCoche[]>('/traceability/series-por-tipo-coche')
  return data
}
