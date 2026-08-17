import { useQuery } from '@tanstack/react-query'
import { obtenerDetallePronostico, obtenerPromedioPorVagon, obtenerProyeccionDiscos, obtenerPronostico } from './api'
import type { ProyeccionDiscosParams, RangoPronosticoMeses, TipoEventoPronostico } from './types'

const claves = {
  discos: (params: ProyeccionDiscosParams) => ['projection', 'discos', params] as const,
  promedioPorVagon: () => ['projection', 'promedio-por-vagon'] as const,
  pronostico: (tren: number | undefined, meses: RangoPronosticoMeses) =>
    ['projection', 'pronostico', tren ?? 'global', meses] as const,
  detallePronostico: (tren: number | undefined, periodo: string, tipo?: TipoEventoPronostico) =>
    ['projection', 'pronostico', 'detalle', tren ?? 'global', periodo, tipo ?? 'todos'] as const,
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
// en features/wear-rate/queries.ts. `meses` es el rango elegido en el
// selector de TablaPronostico (12/24/36/48/60) — cambiarlo dispara un nuevo
// fetch, con su propia entrada de caché por rango.
export function usePronostico(tren: number | undefined, meses: RangoPronosticoMeses, enabled = true) {
  return useQuery({
    queryKey: claves.pronostico(tren, meses),
    queryFn: () => obtenerPronostico(tren, meses),
    enabled,
  })
}

export function useDetallePronostico(tren: number | undefined, periodo: string | null, tipo?: TipoEventoPronostico) {
  return useQuery({
    queryKey: claves.detallePronostico(tren, periodo ?? '', tipo),
    queryFn: () => obtenerDetallePronostico(tren, periodo!, tipo),
    enabled: periodo !== null,
  })
}
