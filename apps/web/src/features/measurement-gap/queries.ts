import { useQuery } from '@tanstack/react-query'
import { obtenerMeasurementGapSummary } from './api'

// Sin override -> usa measurement_gap_umbral_meses de system_params (ver
// MeasurementGapConfigService). Mismo criterio que fleet-completeness: no
// depende de ningún fileId/filtro de la pantalla, siempre contra el
// histórico confirmado completo.
export function useMeasurementGapSummary() {
  return useQuery({
    queryKey: ['measurement-gap', 'summary'],
    queryFn: () => obtenerMeasurementGapSummary(),
    staleTime: 60 * 1000,
  })
}
