import { useQuery } from '@tanstack/react-query'
import type { Fabricante } from '../inventory/types'
import { obtenerFleetDetalle, obtenerFleetHistoricoDisco, obtenerFleetSummary, obtenerResumenTrenesCriticos } from './api'

export const clavesFleet = {
  summary: ['fleet', 'summary'] as const,
  detalle: (tren: number) => ['fleet', 'detalle', tren] as const,
  historico: (codigoDisco: string | null, lado: string | null) =>
    ['fleet', 'historico', codigoDisco ?? '', lado ?? ''] as const,
  resumenTrenesCriticos: (fabricante?: Fabricante) => ['fleet', 'trenes-criticos-resumen', fabricante ?? null] as const,
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

export function useResumenTrenesCriticos(fabricante?: Fabricante) {
  return useQuery({
    queryKey: clavesFleet.resumenTrenesCriticos(fabricante),
    queryFn: () => obtenerResumenTrenesCriticos(fabricante),
    staleTime: 30 * 1000,
  })
}
