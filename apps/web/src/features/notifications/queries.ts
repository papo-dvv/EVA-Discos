import { useQuery } from '@tanstack/react-query'
import { listarNotificaciones } from './api'

export function useNotificaciones() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: listarNotificaciones,
  })
}
