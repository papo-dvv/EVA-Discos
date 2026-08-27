import { apiClient } from '../../lib/apiClient'
import type {
  EditarEjeInput,
  InventoryQuery,
  InventoryResult,
  InventoryStats,
  RegistrarEjeInput,
} from './types'

export async function obtenerInventario(query: InventoryQuery): Promise<InventoryResult> {
  const { data } = await apiClient.get<InventoryResult>('/inventory', { params: query })
  return data
}

export async function obtenerStatsInventario(): Promise<InventoryStats> {
  const { data } = await apiClient.get<InventoryStats>('/inventory/stats')
  return data
}

export async function registrarEje(input: RegistrarEjeInput) {
  const { data } = await apiClient.post('/inventory', input)
  return data
}

export async function editarEje(serie: string, input: EditarEjeInput) {
  const { data } = await apiClient.patch(`/inventory/${encodeURIComponent(serie)}`, input)
  return data
}

export async function eliminarEje(serie: string) {
  const { data } = await apiClient.delete(`/inventory/${encodeURIComponent(serie)}`)
  return data
}

export async function devolverAlmacen(discIds: string[], encargadoNombre: string) {
  const { data } = await apiClient.post('/inventory/devolver-almacen', { discIds, encargadoNombre })
  return data
}
