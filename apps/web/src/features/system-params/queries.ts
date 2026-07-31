import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { actualizarSystemParam, listarSystemParams } from './api'

const claves = {
  lista: ['system-params'] as const,
}

export function useSystemParams() {
  return useQuery({
    queryKey: claves.lista,
    queryFn: listarSystemParams,
    staleTime: 60 * 1000,
  })
}

export function useActualizarSystemParam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: string }) =>
      actualizarSystemParam(clave, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claves.lista }),
  })
}
