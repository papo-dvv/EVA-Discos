import { useQuery } from '@tanstack/react-query'
import { obtenerHistorial, obtenerKpisHistorial } from './api'
import type { FiltrosHistorial } from './types'

export const clavesHistorial = {
  listar: (filtros: FiltrosHistorial) => ['historial', 'listar', filtros] as const,
  kpis: (filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>) =>
    ['historial', 'kpis', filtros] as const,
}

export function useHistorial(filtros: FiltrosHistorial) {
  return useQuery({
    queryKey: clavesHistorial.listar(filtros),
    queryFn: () => obtenerHistorial(filtros),
    staleTime: 30 * 1000,
  })
}

export function useKpisHistorial(filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>) {
  return useQuery({
    queryKey: clavesHistorial.kpis(filtros),
    queryFn: () => obtenerKpisHistorial(filtros),
    staleTime: 30 * 1000,
  })
}
