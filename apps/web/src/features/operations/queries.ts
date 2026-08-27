import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cambiarDisco,
  obtenerDetalleTrenOperaciones,
  obtenerTrenesPendientesReperfilado,
  retirarMasivo,
} from './api'

export function useDetalleTrenOperaciones(trenNumero: number | undefined) {
  return useQuery({
    queryKey: ['operations', 'detalleTren', trenNumero],
    queryFn: () => obtenerDetalleTrenOperaciones(trenNumero as number),
    enabled: trenNumero !== undefined,
  })
}

export function useTrenesPendientesReperfilado() {
  return useQuery({
    queryKey: ['operations', 'reperfilado-pendiente'],
    queryFn: obtenerTrenesPendientesReperfilado,
  })
}

function invalidarTrasOperacion(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['inventory'] })
  queryClient.invalidateQueries({ queryKey: ['operations'] })
  queryClient.invalidateQueries({ queryKey: ['fleet'] })
}

export function useRetiroMasivo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: retirarMasivo,
    onSuccess: () => invalidarTrasOperacion(queryClient),
  })
}

export function useCambioDisco() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cambiarDisco,
    onSuccess: () => invalidarTrasOperacion(queryClient),
  })
}
