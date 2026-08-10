export type ModuloSnapshot = 'trazabilidad' | 'proyeccion'

// Espejo del ModuleSnapshot del backend (GET /module-snapshot/last) — acá
// solo interesa `generadoEn` para el "Última actualización: [fecha]" de
// ambas pantallas; `datosCompletos` viaja pero no se consume todavía (el
// botón de actualizar sigue deshabilitado, ver EstadoActualizacionModulo).
export interface ModuleSnapshotResponse {
  id: string
  modulo: ModuloSnapshot
  mesAnio: string
  datosCompletos: unknown
  generadoEn: string
  generadoPor: string | null
}
