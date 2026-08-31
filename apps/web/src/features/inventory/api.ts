import { apiClient } from '../../lib/apiClient'
import type {
  CambiosDiscoAnio,
  EditarEjeInput,
  InventoryQuery,
  InventoryResult,
  InventoryStats,
  PuntoCambiosRealesMes,
  PuntoRetirosMes,
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

export async function obtenerRetirosPorMes(): Promise<PuntoRetirosMes[]> {
  const { data } = await apiClient.get<PuntoRetirosMes[]>('/inventory/retiros-por-mes')
  return data
}

export async function obtenerCambiosDiscoAnio(): Promise<CambiosDiscoAnio> {
  const { data } = await apiClient.get<CambiosDiscoAnio>('/inventory/cambios-disco-anio')
  return data
}

export async function obtenerCambiosRealesPorMes(): Promise<PuntoCambiosRealesMes[]> {
  const { data } = await apiClient.get<PuntoCambiosRealesMes[]>('/inventory/cambios-reales-por-mes')
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
