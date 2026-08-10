import { apiClient } from '../../lib/apiClient'
import type {
  PromedioPorTren,
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

export async function obtenerPromedioPorTren(tren?: number): Promise<PromedioPorTren> {
  const { data } = await apiClient.get<PromedioPorTren>('/traceability/promedio-por-tren', {
    params: tren !== undefined ? { tren } : undefined,
  })
  return data
}
