import type { EstadoDisco, LadoDisco } from '../scan-records/types'
import type { ProyeccionDiscosParams } from './types'

// Estado de UI de los filtros combinables de /projection/discos. Mismo
// patrón que features/wear-rate/filtros.ts: los rangos (fecha y numéricos) se
// guardan como strings (valor crudo del input) y se convierten al construir
// los params. Estos filtros SOLO afectan la tabla principal — nunca el
// pronóstico de 12 meses ni las tarjetas de promedio por vagón.
export type FiltrosStateProyeccion = {
  modoCombinacion: 'AND' | 'OR'
  estado: EstadoDisco[]
  siguienteReperfiladoDesde: string
  siguienteReperfiladoHasta: string
  siguienteCambioDesde: string
  siguienteCambioHasta: string
  hMin: string
  hMax: string
  tMin: string
  tMax: string
  rdMin: string
  rdMax: string
  ejeMin: string
  ejeMax: string
  ruedaMin: string
  ruedaMax: string
  lado: LadoDisco[]
  motivo: string[]
  responsable: string[]
}

export const FILTROS_VACIOS_PROYECCION: FiltrosStateProyeccion = {
  modoCombinacion: 'AND',
  estado: [],
  siguienteReperfiladoDesde: '',
  siguienteReperfiladoHasta: '',
  siguienteCambioDesde: '',
  siguienteCambioHasta: '',
  hMin: '',
  hMax: '',
  tMin: '',
  tMax: '',
  rdMin: '',
  rdMax: '',
  ejeMin: '',
  ejeMax: '',
  ruedaMin: '',
  ruedaMax: '',
  lado: [],
  motivo: [],
  responsable: [],
}

const CAMPOS_RANGO: (keyof FiltrosStateProyeccion)[] = [
  'hMin',
  'hMax',
  'tMin',
  'tMax',
  'rdMin',
  'rdMax',
  'ejeMin',
  'ejeMax',
  'ruedaMin',
  'ruedaMax',
]

function num(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

// Cantidad de filtros activos, para el contador del botón "Limpiar".
export function contarFiltrosActivosProyeccion(f: FiltrosStateProyeccion): number {
  let n = 0
  if (f.estado.length) n++
  if (f.siguienteReperfiladoDesde || f.siguienteReperfiladoHasta) n++
  if (f.siguienteCambioDesde || f.siguienteCambioHasta) n++
  for (const campo of CAMPOS_RANGO) if ((f[campo] as string).trim() !== '') n++
  if (f.lado.length) n++
  if (f.motivo.length) n++
  if (f.responsable.length) n++
  return n
}

// Fusiona el estado de filtros dentro de los ProyeccionDiscosParams base
// (paginación/tren). Un filtro vacío se manda como undefined (no se aplica).
export function aplicarFiltrosProyeccion(
  base: ProyeccionDiscosParams,
  f: FiltrosStateProyeccion,
): ProyeccionDiscosParams {
  return {
    ...base,
    modoCombinacion: f.modoCombinacion,
    estado: f.estado.length ? f.estado : undefined,
    siguienteReperfiladoDesde: f.siguienteReperfiladoDesde || undefined,
    siguienteReperfiladoHasta: f.siguienteReperfiladoHasta || undefined,
    siguienteCambioDesde: f.siguienteCambioDesde || undefined,
    siguienteCambioHasta: f.siguienteCambioHasta || undefined,
    hMin: num(f.hMin),
    hMax: num(f.hMax),
    tMin: num(f.tMin),
    tMax: num(f.tMax),
    rdMin: num(f.rdMin),
    rdMax: num(f.rdMax),
    ejeMin: num(f.ejeMin),
    ejeMax: num(f.ejeMax),
    ruedaMin: num(f.ruedaMin),
    ruedaMax: num(f.ruedaMax),
    lado: f.lado.length ? f.lado : undefined,
    motivo: f.motivo.length ? f.motivo : undefined,
    responsable: f.responsable.length ? f.responsable : undefined,
  }
}
