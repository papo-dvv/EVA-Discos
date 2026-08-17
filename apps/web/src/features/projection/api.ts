import { apiClient } from '../../lib/apiClient'
import type {
  ProyeccionDiscosParams,
  ProyeccionDiscosResult,
  PromedioPorVagon,
  EventoPronostico,
  PronosticoMes,
  RangoPronosticoMeses,
  TipoEventoPronostico,
} from './types'

export async function obtenerProyeccionDiscos(params: ProyeccionDiscosParams): Promise<ProyeccionDiscosResult> {
  const { data } = await apiClient.get<ProyeccionDiscosResult>('/projection/discos', { params })
  return data
}

export async function obtenerDetallePronostico(
  tren: number | undefined,
  periodo: string,
  tipo?: TipoEventoPronostico,
): Promise<EventoPronostico[]> {
  const { data } = await apiClient.get<EventoPronostico[]>('/projection/pronostico/detalle', {
    params: { tren, periodo, tipo },
  })
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
