import { apiClient } from '../../lib/apiClient'
import type {
  ProyeccionDiscosParams,
  ProyeccionDiscosResult,
  PromedioPorVagon,
  PronosticoMes,
  RangoPronosticoMeses,
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

export async function obtenerPronostico(
  tren: number | undefined,
  meses: RangoPronosticoMeses,
): Promise<PronosticoMes[]> {
  const { data } = await apiClient.get<PronosticoMes[]>('/projection/pronostico', {
    params: { tren, meses },
  })
  return data
}
