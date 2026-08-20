import type { PreviewRow } from '../scan-records/types'

// Lógica pura (sin componentes): a partir de las filas de la referencia
// "última medición" del tren (GET /new-measurement/reference?tipo=ultima_medicion),
// arma un mapa por disco físico (eje+lado) con el T/Rd previo — el backend
// solo expone los flags booleanos (tInvalido/rdInvalido) en la ficha en
// curso, nunca el valor anterior en sí; este mapa es lo que permite mostrar
// "T actual (10) > último confirmado (8)" en el tooltip de alerta de la
// tabla (punto 1 del enunciado) en vez de un mensaje genérico.
export interface ValorPrevioDisco {
  tValue: number
  hValue: number
  rdValue: number
}

export function construirMapaReferenciaPorEjeLado(
  rows: PreviewRow[],
): Map<string, ValorPrevioDisco> {
  const mapa = new Map<string, ValorPrevioDisco>()
  for (const fila of rows) {
    if (fila.ejeExcel === null || !fila.ubicacionExcel) continue
    mapa.set(`${fila.ejeExcel}|${fila.ubicacionExcel}`, {
      tValue: fila.tValue,
      hValue: fila.hValue,
      rdValue: fila.rdValue,
    })
  }
  return mapa
}
