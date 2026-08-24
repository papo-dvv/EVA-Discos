import { apiClient } from '../../lib/apiClient'
import type { FleetDetalle } from '../fleet/types'
import type { CambioDiscoInput, ResultadoOperacion, RetiroMasivoInput } from './types'

// Mismo dato que GET /fleet/:tren/detalle (el diagrama de coche/bogie/eje),
// reexpuesto bajo el gate de roles de Operaciones (ver OperationsController).
export async function obtenerDetalleTrenOperaciones(trenNumero: number): Promise<FleetDetalle> {
  const { data } = await apiClient.get<FleetDetalle>(`/operations/tren/${trenNumero}/detalle`)
  return data
}

export async function retirarMasivo(input: RetiroMasivoInput): Promise<ResultadoOperacion> {
  const { data } = await apiClient.post<ResultadoOperacion>('/operations/retiro-masivo', input)
  return data
}

export async function cambiarDisco(input: CambioDiscoInput): Promise<ResultadoOperacion> {
  const { data } = await apiClient.post<ResultadoOperacion>('/operations/cambio-disco', input)
  return data
}
