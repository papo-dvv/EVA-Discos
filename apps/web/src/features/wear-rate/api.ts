import { apiClient } from '../../lib/apiClient'
import type {
  PuntoChartTasaPorCoche,
  PuntoChartWearRate,
  WearRatePairsParams,
  WearRatePairsResult,
  WearRateSummary,
} from './types'

export async function obtenerWearRatePairs(
  params: WearRatePairsParams,
): Promise<WearRatePairsResult> {
  const { data } = await apiClient.get<WearRatePairsResult>('/wear-rate/pairs', { params })
  return data
}

export async function obtenerWearRateChart(tren?: number): Promise<PuntoChartWearRate[]> {
  const { data } = await apiClient.get<PuntoChartWearRate[]>('/wear-rate/chart', {
    params: { tren, groupBy: 'month' },
  })
  return data
}

export async function obtenerWearRateChartPorCoche(): Promise<PuntoChartTasaPorCoche[]> {
  const { data } = await apiClient.get<PuntoChartTasaPorCoche[]>('/wear-rate/chart-por-coche')
  return data
}

export async function obtenerWearRateSummary(tren?: number): Promise<WearRateSummary> {
  const { data } = await apiClient.get<WearRateSummary>('/wear-rate/summary', {
    params: { tren },
  })
  return data
}
