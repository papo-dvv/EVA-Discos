// Espejo de apps/api/src/fleet-completeness (FleetCompletenessService) —
// completitud del catálogo de flota esperada (39 trenes ALSTOM, 48 discos
// c/u) contra el historial de mediciones CONFIRMADAS.
import type { LadoDisco } from '../scan-records/types'

export interface FleetCompletenessTren {
  tren: number
  discosEsperados: number
  discosConAlMenosUnaMedicionHistorica: number
  discosFaltantes: number
}

export type FleetCompletenessTotal = Omit<FleetCompletenessTren, 'tren'>

export interface FleetCompletenessSummary {
  porTren: FleetCompletenessTren[]
  total: FleetCompletenessTotal
}

export interface FleetCompletenessDetalleFila {
  coche: string
  numeroCoche: number
  bogie: string
  eje: number
  lado: LadoDisco
}
