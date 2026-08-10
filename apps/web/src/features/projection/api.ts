import { apiClient } from '../../lib/apiClient'
import type {
  ProyeccionDiscosParams,
  ProyeccionDiscosResult,
  PromedioPorVagon,
  PronosticoMes,
} from './types'

export async function obtenerProyeccionDiscos(
  params: ProyeccionDiscosParams,
): Promise<ProyeccionDiscosResult> {
  const { data } = await apiClient.get<ProyeccionDiscosResult>('/projection/discos', { params })
  return data
}

export async function obtenerPromedioPorVagon(): Promise<PromedioPorVagon[]> {
  const { data } = await apiClient.get<PromedioPorVagon[]>('/projection/promedio-por-vagon')
  return data
}

export async function obtenerPronostico12Meses(tren?: number): Promise<PronosticoMes[]> {
  const { data } = await apiClient.get<PronosticoMes[]>('/projection/pronostico-12-meses', {
    params: { tren },
  })
  return data
}
