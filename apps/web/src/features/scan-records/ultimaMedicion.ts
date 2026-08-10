import type { PreviewRow } from './types'

// Cálculos puros de "última medición registrada" a partir de filas YA
// colapsadas por disco (vistaFecha='ultima') y YA ordenadas desc por fecha
// (sortBy='fecha', sortDir='desc') — ver TarjetaUltimaMedicion. No hay
// endpoint de backend dedicado para esto (este prompt es frontend-only): se
// deriva de la misma consulta paginada de scan-records/migration ya
// existente, pidiendo el máximo pageSize permitido (200, ver
// PreviewQueryDto.pageSize) como muestra representativa.

export interface UltimaMedicionGlobal {
  fecha: string
  trenes: number[]
  // true si la muestra (pageSize=200) se agotó sin terminar de recorrer
  // todas las filas que podrían compartir la fecha máxima — en la práctica
  // no debería pasar (implicaría 200+ discos medidos el mismo día exacto),
  // pero se expone para no afirmar de más si algún día ocurre.
  muestraLimitada: boolean
}

export function calcularUltimaMedicionGlobal(
  rows: PreviewRow[],
  pageSizeMuestra: number,
): UltimaMedicionGlobal | null {
  if (rows.length === 0) return null
  const fecha = rows[0].fecha
  const trenes = [...new Set(rows.filter((r) => r.fecha === fecha).map((r) => r.trenNumero))].sort(
    (a, b) => a - b,
  )
  return { fecha, trenes, muestraLimitada: rows.length >= pageSizeMuestra }
}

export interface UltimaMedicionTren {
  fecha: string
  coche: string | null
  numeroCoche: number | null
  // true = TODOS los discos con datos de este tren comparten esa fecha
  // exacta (ej. carga inicial masiva) -> "toda la flota del tren" en vez de
  // listar bogie por bogie.
  todaLaFlota: boolean
  // Filas que comparten la fecha máxima (1 si fue un disco puntual, varias
  // si fue un grupo de discos el mismo día).
  filas: PreviewRow[]
  totalDiscosConDatos: number
}

export function calcularUltimaMedicionTren(rows: PreviewRow[]): UltimaMedicionTren | null {
  if (rows.length === 0) return null
  const fecha = rows[0].fecha
  const filas = rows.filter((r) => r.fecha === fecha)
  // > 1 evita etiquetar como "toda la flota" el caso trivial de un tren con
  // un único disco confirmado hasta ahora.
  const todaLaFlota = filas.length === rows.length && rows.length > 1
  return {
    fecha,
    coche: rows[0].cocheExcel,
    numeroCoche: rows[0].numeroCocheExcel,
    todaLaFlota,
    filas,
    totalDiscosConDatos: rows.length,
  }
}
