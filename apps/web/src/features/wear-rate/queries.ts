import { useQuery } from '@tanstack/react-query'
import { obtenerWearRateChart, obtenerWearRatePairs, obtenerWearRateSummary } from './api'
import type { WearRatePairsParams } from './types'

const claves = {
  pairs: (params: WearRatePairsParams) => ['wear-rate', 'pairs', params] as const,
  chart: (tren?: number) => ['wear-rate', 'chart', tren ?? 'global'] as const,
  summary: (tren?: number) => ['wear-rate', 'summary', tren ?? 'global'] as const,
}

export function useWearRatePairs(params: WearRatePairsParams) {
  return useQuery({
    queryKey: claves.pairs(params),
    queryFn: () => obtenerWearRatePairs(params),
  })
}

export function useWearRateChart(tren?: number) {
  return useQuery({
    queryKey: claves.chart(tren),
    queryFn: () => obtenerWearRateChart(tren),
  })
}

export function useWearRateSummary(tren?: number) {
  return useQuery({
    queryKey: claves.summary(tren),
    queryFn: () => obtenerWearRateSummary(tren),
  })
}
