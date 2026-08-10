import { apiClient } from '../../lib/apiClient'
import type { MeasurementGapSummary } from './types'

export async function obtenerMeasurementGapSummary(
  umbralMeses?: number,
): Promise<MeasurementGapSummary> {
  const { data } = await apiClient.get<MeasurementGapSummary>('/measurement-gap/summary', {
    params: umbralMeses !== undefined ? { umbralMeses } : undefined,
  })
  return data
}
