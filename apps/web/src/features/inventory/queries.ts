import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerInventario, obtenerStatsInventario, registrarDisco } from './api'
import type { InventoryQuery } from './types'

export const clavesInventory = {
  listar: (query: InventoryQuery) => ['inventory', 'listar', query] as const,
  stats: ['inventory', 'stats'] as const,
}

export function useInventario(query: InventoryQuery) {
  return useQuery({
    queryKey: clavesInventory.listar(query),
    queryFn: () => obtenerInventario(query),
    placeholderData: (data) => data,
  })
}

export function useStatsInventario() {
  return useQuery({
    queryKey: clavesInventory.stats,
    queryFn: obtenerStatsInventario,
    staleTime: 30 * 1000,
  })
}

export function useRegistrarDisco() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registrarDisco,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
