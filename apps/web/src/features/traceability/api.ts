import { apiClient } from '../../lib/apiClient'
import type {
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
