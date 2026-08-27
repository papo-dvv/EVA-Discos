import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  devolverAlmacen,
  editarEje,
  eliminarEje,
  obtenerInventario,
  obtenerStatsInventario,
  registrarEje,
} from './api'
import type { EditarEjeInput, InventoryQuery } from './types'

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

function useInvalidarInventario() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['inventory'] })
}

export function useRegistrarEje() {
  const invalidar = useInvalidarInventario()
  return useMutation({
    mutationFn: registrarEje,
    onSuccess: invalidar,
  })
}

export function useEditarEje() {
  const invalidar = useInvalidarInventario()
  return useMutation({
    mutationFn: ({ serie, cambios }: { serie: string; cambios: EditarEjeInput }) => editarEje(serie, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarEje() {
  const invalidar = useInvalidarInventario()
  return useMutation({
    mutationFn: eliminarEje,
    onSuccess: invalidar,
  })
}

export function useDevolverAlmacen() {
  const invalidar = useInvalidarInventario()
  return useMutation({
    mutationFn: ({ discIds, encargadoNombre }: { discIds: string[]; encargadoNombre: string }) =>
      devolverAlmacen(discIds, encargadoNombre),
    onSuccess: invalidar,
  })
}
