import { useQuery } from '@tanstack/react-query'
import { obtenerFleetCompletenessDetalle, obtenerFleetCompletenessSummary } from './api'

const claves = {
  summary: ['fleet-completeness', 'summary'] as const,
  detalle: (tren: number) => ['fleet-completeness', 'detalle', tren] as const,
}

// Catálogo de flota completo: no depende de ningún fileId/filtro de la
// pantalla — mismo resultado en Migración (preview) y en Mediciones
// confirmadas, siempre visto contra el histórico YA CONFIRMADO.
export function useFleetCompletenessSummary() {
  return useQuery({
    queryKey: claves.summary,
    queryFn: obtenerFleetCompletenessSummary,
    staleTime: 60 * 1000,
  })
}

export function useFleetCompletenessDetalle(tren: number | null) {
  return useQuery({
    queryKey: claves.detalle(tren ?? -1),
    queryFn: () => obtenerFleetCompletenessDetalle(tren as number),
    enabled: tren !== null,
  })
}
