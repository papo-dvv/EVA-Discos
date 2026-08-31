import { apiClient } from '../../lib/apiClient'
import type { Fabricante } from '../inventory/types'
import type { FleetDetalle, FleetHistoricoDisco, FleetSummaryItem, ResumenTrenesCriticos } from './types'

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

export async function obtenerResumenTrenesCriticos(fabricante?: Fabricante): Promise<ResumenTrenesCriticos> {
  const { data } = await apiClient.get<ResumenTrenesCriticos>('/fleet/trenes-criticos-resumen', {
    params: fabricante ? { fabricante } : undefined,
  })
  return data
}
