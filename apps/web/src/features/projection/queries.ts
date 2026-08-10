import { useQuery } from '@tanstack/react-query'
import { obtenerPromedioPorVagon, obtenerProyeccionDiscos, obtenerPronostico12Meses } from './api'
import type { ProyeccionDiscosParams } from './types'

const claves = {
  discos: (params: ProyeccionDiscosParams) => ['projection', 'discos', params] as const,
  promedioPorVagon: () => ['projection', 'promedio-por-vagon'] as const,
  pronostico: (tren?: number) => ['projection', 'pronostico-12-meses', tren ?? 'global'] as const,
}

export function useProyeccionDiscos(params: ProyeccionDiscosParams) {
  return useQuery({
    queryKey: claves.discos(params),
    queryFn: () => obtenerProyeccionDiscos(params),
  })
}

export function usePromedioPorVagon() {
  return useQuery({
    queryKey: claves.promedioPorVagon(),
    queryFn: obtenerPromedioPorVagon,
  })
}

// El pronóstico respeta el mismo `tren` del toggle General/Por tren, pero
// nunca los filtros de la tabla principal (estado/H/T/Rd/fechas) — es un
// query independiente, mismo criterio que useWearRateChart/useWearRateSummary
// en features/wear-rate/queries.ts.
export function usePronostico12Meses(tren?: number) {
  return useQuery({
    queryKey: claves.pronostico(tren),
    queryFn: () => obtenerPronostico12Meses(tren),
  })
}
