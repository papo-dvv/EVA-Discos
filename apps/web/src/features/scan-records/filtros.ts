import type { EstadoDisco, LadoDisco, PreviewParams, VistaFecha } from './types'

// Estado de UI de los filtros combinables de la vista previa. Los rangos se
// guardan como strings (valor crudo del input) y se convierten a número al
// construir los PreviewParams. Mode-agnostic: sirve igual para el borrador de
// una migración en curso y para la vista permanente de confirmados.
export type FiltrosState = {
  modoCombinacion: 'AND' | 'OR'
  tipoCoche: string[]
  bogieCodigo: string[]
  estado: EstadoDisco[]
  corregidoOAdvertencia: boolean
  fechaDesde: string
  fechaHasta: string
  kilometrajeMin: string
  kilometrajeMax: string
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
  // 'todas' = sin colapsar (comportamiento histórico, sin cambios). No es un
  // filtro que "cuenta" en contarFiltrosActivos por ser en rigor un modo de
  // vista, no una condición que reduce filas — igual criterio que
  // modoCombinacion (tampoco cuenta).
  vistaFecha: VistaFecha
  motivo: string[]
  responsable: string[]
  lado: LadoDisco[]
}

export const FILTROS_VACIOS: FiltrosState = {
  modoCombinacion: 'AND',
  tipoCoche: [],
  bogieCodigo: [],
  estado: [],
  corregidoOAdvertencia: false,
  fechaDesde: '',
  fechaHasta: '',
  kilometrajeMin: '',
  kilometrajeMax: '',
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
  vistaFecha: 'todas',
  motivo: [],
  responsable: [],
  lado: [],
}

const CAMPOS_RANGO: (keyof FiltrosState)[] = [
  'kilometrajeMin',
  'kilometrajeMax',
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
export function contarFiltrosActivos(f: FiltrosState): number {
  let n = 0
  if (f.tipoCoche.length) n++
  if (f.bogieCodigo.length) n++
  if (f.estado.length) n++
  if (f.corregidoOAdvertencia) n++
  if (f.fechaDesde || f.fechaHasta) n++
  for (const campo of CAMPOS_RANGO) if ((f[campo] as string).trim() !== '') n++
  if (f.motivo.length) n++
  if (f.responsable.length) n++
  if (f.lado.length) n++
  return n
}

// Fusiona el estado de filtros dentro de los PreviewParams base (paginación,
// orden, búsqueda). Un filtro vacío se manda como undefined (no se aplica).
export function aplicarFiltros(base: PreviewParams, f: FiltrosState): PreviewParams {
  return {
    ...base,
    modoCombinacion: f.modoCombinacion,
    tipoCoche: f.tipoCoche.length ? f.tipoCoche : undefined,
    bogieCodigo: f.bogieCodigo.length ? f.bogieCodigo : undefined,
    estado: f.estado.length ? f.estado : undefined,
    corregidoOAdvertencia: f.corregidoOAdvertencia ? true : undefined,
    fechaDesde: f.fechaDesde || undefined,
    fechaHasta: f.fechaHasta || undefined,
    kilometrajeMin: num(f.kilometrajeMin),
    kilometrajeMax: num(f.kilometrajeMax),
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
    vistaFecha: f.vistaFecha !== 'todas' ? f.vistaFecha : undefined,
    motivo: f.motivo.length ? f.motivo : undefined,
    responsable: f.responsable.length ? f.responsable : undefined,
    lado: f.lado.length ? f.lado : undefined,
  }
}
