import { apiClient } from '../../lib/apiClient'
import type { EventoHistorial, FiltrosHistorial, KpisHistorial } from './types'

export async function obtenerHistorial(filtros: FiltrosHistorial): Promise<EventoHistorial[]> {
  const { data } = await apiClient.get<EventoHistorial[]>('/historial', { params: filtros })
  return data
}

export async function obtenerKpisHistorial(
  filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>,
): Promise<KpisHistorial> {
  const { data } = await apiClient.get<KpisHistorial>('/historial/kpis', { params: filtros })
  return data
}
