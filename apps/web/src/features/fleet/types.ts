import type { EstadoDisco, LadoDisco } from '../scan-records/types'

// unica = Alstom (un solo disco por lado); interior/exterior = Ansaldo (2
// discos por lado).
export type PosicionDisco = 'unica' | 'interior' | 'exterior'

export interface FleetSummaryItem {
  tren: number
  fechaUltimaMedicion: string | null
  kilometrajeActual: number | null
  conteoEstado: {
    ok: number
    seguimiento: number
    cambio: number
    critico: number
    reperfilado: number
  }
}

export interface FleetDiscoDetalle {
  codigoDisco: string | null
  lado: LadoDisco
  posicion: PosicionDisco
  rd: number | null
  h: number | null
  t: number | null
  estadoCalculado: EstadoDisco | null
  fechaUltimaMedicion: string | null
}

export interface FleetEjeDetalle {
  eje: number
  discos: FleetDiscoDetalle[]
}

export interface FleetBogieDetalle {
  bogie: string
  ejes: FleetEjeDetalle[]
}

export interface FleetCocheDetalle {
  coche: string
  numeroCoche: number | null
  bogies: FleetBogieDetalle[]
}

export interface FleetDetalle {
  tren: number
  coches: FleetCocheDetalle[]
}

export interface FleetHistoricoPunto {
  fecha: string | null
  h: number | null
  t: number | null
  rd: number | null
  estadoCalculado: EstadoDisco | null
}

export interface FleetHistoricoDisco {
  codigoDisco: string
  lado: LadoDisco
  actual: FleetHistoricoPunto
  historico: FleetHistoricoPunto[]
}
