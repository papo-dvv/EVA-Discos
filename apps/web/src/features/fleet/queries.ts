import { useQuery } from '@tanstack/react-query'
import { obtenerFleetDetalle, obtenerFleetHistoricoDisco, obtenerFleetSummary } from './api'

export const clavesFleet = {
  summary: ['fleet', 'summary'] as const,
  detalle: (tren: number) => ['fleet', 'detalle', tren] as const,
  historico: (codigoDisco: string | null, lado: string | null) =>
    ['fleet', 'historico', codigoDisco ?? '', lado ?? ''] as const,
}

export function useFleetSummary() {
  return useQuery({
    queryKey: clavesFleet.summary,
    queryFn: obtenerFleetSummary,
    staleTime: 60 * 1000,
  })
}

export function useFleetDetalle(tren: number) {
  return useQuery({
    queryKey: clavesFleet.detalle(tren),
    queryFn: () => obtenerFleetDetalle(tren),
    staleTime: 60 * 1000,
  })
}

export function useFleetHistorico(codigoDisco: string | null, lado: string | null) {
  return useQuery({
    queryKey: clavesFleet.historico(codigoDisco, lado),
    queryFn: () => obtenerFleetHistoricoDisco(codigoDisco as string, lado as string),
    enabled: Boolean(codigoDisco && lado),
  })
}
