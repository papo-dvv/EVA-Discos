import { apiClient } from '../../lib/apiClient'
import type {
  InventoryQuery,
  InventoryResult,
  InventoryStats,
  RegistrarDiscoInput,
} from './types'

export async function obtenerInventario(query: InventoryQuery): Promise<InventoryResult> {
  const { data } = await apiClient.get<InventoryResult>('/inventory', { params: query })
  return data
}

export async function obtenerStatsInventario(): Promise<InventoryStats> {
  const { data } = await apiClient.get<InventoryStats>('/inventory/stats')
  return data
}

export async function registrarDisco(input: RegistrarDiscoInput) {
  const { data } = await apiClient.post('/inventory', input)
  return data
}
