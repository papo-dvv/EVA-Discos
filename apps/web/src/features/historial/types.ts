// Espejo de apps/api/src/historial/historial.service.ts — capa de lectura
// sobre InventoryMovement (cambios de disco reales) + MeasurementHistoryEvent
// (mediciones/reperfilados confirmados), NO una tabla de eventos propia.
export type TipoEventoHistorial = 'CAMBIO_DISCO' | 'MEDICION' | 'REPERFILADO'

export interface EventoHistorial {
  tipo: TipoEventoHistorial
  fecha: string
  trenNumero: number | null
  cocheNumero: number | null
  bogieCodigo: string | null
  ejeNumero: number | null
  descripcion: string
}

export interface FiltrosHistorial {
  tipo?: TipoEventoHistorial[]
  desde?: string
  hasta?: string
  tren?: number
  limit?: number
}

export interface KpisHistorial {
  total: number
  ultimaSemana: number
  trenesAfectados: number
  tiposDiferentes: number
}
