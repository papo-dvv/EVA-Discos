// Espejo de apps/api/src/measurement-gap (MeasurementGapService) — "hace
// cuánto no se mide" cada disco físico con al menos 1 medición confirmada.
import type { LadoDisco } from '../scan-records/types'

export type CategoriaMeasurementGap = 'normal' | 'alerta' | 'alertaSevera'

export interface FilaAlertaMeasurementGap {
  categoria: Exclude<CategoriaMeasurementGap, 'normal'>
  tren: number
  coche: string
  numeroCoche: number
  bogie: string
  eje: number
  lado: LadoDisco
  fechaUltimaMedicion: string
  mesesSinMedir: number
}

export interface MeasurementGapSummary {
  umbralMesesUsado: number
  // Fijo en 7 (ver MeasurementGapService) — nunca se muestra tal cual en la
  // UI: el texto siempre dice "mayor a 6 meses", ver TarjetaBrechaFechas.
  umbralSeveroMeses: number
  conteos: Record<CategoriaMeasurementGap, number>
  discos: FilaAlertaMeasurementGap[]
}
