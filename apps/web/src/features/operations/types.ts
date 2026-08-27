export interface RetiroMasivoInput {
  discIds: string[]
  encargadoNombre: string
  encargadoFirma?: string
  supervisorNombre?: string
  numeroPt?: string
  justificacion?: string
  fecha?: string
}

export interface AsignacionEje {
  bogieCodigo: string
  ejeNumero: number
  discoNuevoIzquierdoId: string
  discoNuevoDerechoId: string
}

export interface CambioDiscoInput {
  numeroCoche: number
  asignaciones: AsignacionEje[]
  tecnicoNombre: string
  supervisorNombre?: string
  numeroPt?: string
  justificacion?: string
  firma?: string
  fecha?: string
}

export interface ResultadoOperacion {
  operacionId: string
  discosRemovidos?: string[]
  discosMontados?: string[]
}

export interface TrenPendienteReperfilado {
  tren: number
  discosReperfilado: number
  fechaUltimaMedicion: string | null
  kilometrajeActual: number | null
}
