import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  devolverAlmacen,
  editarEje,
  eliminarEje,
  obtenerCambiosDiscoAnio,
  obtenerCambiosRealesPorMes,
  obtenerInventario,
  obtenerRetirosPorMes,
  obtenerStatsInventario,
  registrarEje,
} from './api'
import type { EditarEjeInput, InventoryQuery } from './types'

export const clavesInventory = {
  listar: (query: InventoryQuery) => ['inventory', 'listar', query] as const,
  stats: ['inventory', 'stats'] as const,
  retirosPorMes: ['inventory', 'retiros-por-mes'] as const,
  cambiosDiscoAnio: ['inventory', 'cambios-disco-anio'] as const,
  cambiosRealesPorMes: ['inventory', 'cambios-reales-por-mes'] as const,
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

export function useRetirosPorMes() {
  return useQuery({
    queryKey: clavesInventory.retirosPorMes,
    queryFn: obtenerRetirosPorMes,
    staleTime: 30 * 1000,
  })
}

export function useCambiosDiscoAnio() {
  return useQuery({
    queryKey: clavesInventory.cambiosDiscoAnio,
    queryFn: obtenerCambiosDiscoAnio,
    staleTime: 30 * 1000,
  })
}

export function useCambiosRealesPorMes() {
  return useQuery({
    queryKey: clavesInventory.cambiosRealesPorMes,
    queryFn: obtenerCambiosRealesPorMes,
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
