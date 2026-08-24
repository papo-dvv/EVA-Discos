export interface RetiroMasivoInput {
  discIds: string[]
  encargadoNombre: string
  encargadoFirma?: string
  fecha?: string
}

export interface CambioDiscoInput {
  numeroCoche: number
  bogieCodigo: string
  ejeNumero: number
  discoNuevoIzquierdoId: string
  discoNuevoDerechoId: string
  tecnicoNombre: string
  supervisorNombre?: string
  numeroPt?: string
  justificacion?: string
  firma?: string
  fecha?: string
}

export interface ResultadoOperacion {
  operacionId: string
}
