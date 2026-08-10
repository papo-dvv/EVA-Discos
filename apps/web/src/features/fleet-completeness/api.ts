import { apiClient } from '../../lib/apiClient'
import type { FleetCompletenessDetalleFila, FleetCompletenessSummary } from './types'

export async function obtenerFleetCompletenessSummary(): Promise<FleetCompletenessSummary> {
  const { data } = await apiClient.get<FleetCompletenessSummary>('/fleet-completeness/summary')
  return data
}

export async function obtenerFleetCompletenessDetalle(
  tren: number,
): Promise<FleetCompletenessDetalleFila[]> {
  const { data } = await apiClient.get<FleetCompletenessDetalleFila[]>(
    '/fleet-completeness/detalle',
    { params: { tren } },
  )
  return data
}
