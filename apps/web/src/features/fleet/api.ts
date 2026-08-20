import { apiClient } from '../../lib/apiClient'
import type { FleetDetalle, FleetHistoricoDisco, FleetSummaryItem } from './types'

export async function obtenerFleetSummary(): Promise<FleetSummaryItem[]> {
  const { data } = await apiClient.get<FleetSummaryItem[]>('/fleet/summary')
  return data
}

export async function obtenerFleetDetalle(tren: number): Promise<FleetDetalle> {
  const { data } = await apiClient.get<FleetDetalle>(`/fleet/${tren}/detalle`)
  return data
}

export async function obtenerFleetHistoricoDisco(
  codigoDisco: string,
  lado: string,
): Promise<FleetHistoricoDisco> {
  const { data } = await apiClient.get<FleetHistoricoDisco>(
    `/fleet/disco/${encodeURIComponent(codigoDisco)}/${encodeURIComponent(lado)}/historico`,
  )
  return data
}
