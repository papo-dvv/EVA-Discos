import { apiClient } from '../../lib/apiClient'
import type { Notificacion } from './types'

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const { data } = await apiClient.get<Notificacion[]>('/notifications')
  return data
}
