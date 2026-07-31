import type { AccionRecomendada, EstadoDisco } from '../scan-records/types'
import type { WearRatePairsParams } from './types'

// Estado de UI de los filtros combinables de /wear-rate/pairs. Mismo patrón
// que features/scan-records/filtros.ts: los rangos se guardan como strings
// (valor crudo del input) y se convierten a número al construir los params.
// Estos filtros SOLO afectan la tabla paginada — nunca el gráfico ni el
// resumen (ver WearRatePairsParams en types.ts).
export type FiltrosStateWearRate = {
  modoCombinacion: 'AND' | 'OR'
  tipoCoche: string[]
  bogieCodigo: string[]
  lado: string[]
  motivoFecha2: string[]
  estado: EstadoDisco[]
  accionRecomendada: AccionRecomendada[]
  soloInvalidos: boolean
  fecha1Desde: string
  fecha1Hasta: string
  fecha2Desde: string
  fecha2Hasta: string
  km1Min: string
  km1Max: string
  km2Min: string
  km2Max: string
  rd1Min: string
  rd1Max: string
  rd2Min: string
  rd2Max: string
  diferenciaKmMin: string
  diferenciaKmMax: string
  diferenciaRdMin: string
  diferenciaRdMax: string
  tasaMin: string
  tasaMax: string
  tasaMensualMin: string
  tasaMensualMax: string
  ejeNumeroMin: string
  ejeNumeroMax: string
}

export const FILTROS_VACIOS_WEAR_RATE: FiltrosStateWearRate = {
  modoCombinacion: 'AND',
  tipoCoche: [],
  bogieCodigo: [],
  lado: [],
  motivoFecha2: [],
  estado: [],
  accionRecomendada: [],
  soloInvalidos: false,
  fecha1Desde: '',
  fecha1Hasta: '',
  fecha2Desde: '',
  fecha2Hasta: '',
  km1Min: '',
  km1Max: '',
  km2Min: '',
  km2Max: '',
  rd1Min: '',
  rd1Max: '',
  rd2Min: '',
  rd2Max: '',
  diferenciaKmMin: '',
  diferenciaKmMax: '',
  diferenciaRdMin: '',
  diferenciaRdMax: '',
  tasaMin: '',
  tasaMax: '',
  tasaMensualMin: '',
  tasaMensualMax: '',
  ejeNumeroMin: '',
  ejeNumeroMax: '',
}

const CAMPOS_RANGO: (keyof FiltrosStateWearRate)[] = [
  'km1Min',
  'km1Max',
  'km2Min',
  'km2Max',
  'rd1Min',
  'rd1Max',
  'rd2Min',
  'rd2Max',
  'diferenciaKmMin',
  'diferenciaKmMax',
  'diferenciaRdMin',
  'diferenciaRdMax',
  'tasaMin',
  'tasaMax',
  'tasaMensualMin',
  'tasaMensualMax',
  'ejeNumeroMin',
  'ejeNumeroMax',
]

function num(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

// Cantidad de filtros activos, para el contador del botón "Limpiar".
export function contarFiltrosActivosWearRate(f: FiltrosStateWearRate): number {
  let n = 0
  if (f.tipoCoche.length) n++
  if (f.bogieCodigo.length) n++
  if (f.lado.length) n++
  if (f.motivoFecha2.length) n++
  if (f.estado.length) n++
  if (f.accionRecomendada.length) n++
  if (f.soloInvalidos) n++
  if (f.fecha1Desde || f.fecha1Hasta) n++
  if (f.fecha2Desde || f.fecha2Hasta) n++
  for (const campo of CAMPOS_RANGO) if ((f[campo] as string).trim() !== '') n++
  return n
}

// Fusiona el estado de filtros dentro de los WearRatePairsParams base
// (paginación/orden/tren). Un filtro vacío se manda como undefined (no se
// aplica) — el backend ignora por completo lo que no venga.
export function aplicarFiltrosWearRate(
  base: WearRatePairsParams,
  f: FiltrosStateWearRate,
): WearRatePairsParams {
  return {
    ...base,
    modoCombinacion: f.modoCombinacion,
    tipoCoche: f.tipoCoche.length ? f.tipoCoche : undefined,
    bogieCodigo: f.bogieCodigo.length ? f.bogieCodigo : undefined,
    lado: f.lado.length ? f.lado : undefined,
    motivoFecha2: f.motivoFecha2.length ? f.motivoFecha2 : undefined,
    estado: f.estado.length ? f.estado : undefined,
    accionRecomendada: f.accionRecomendada.length ? f.accionRecomendada : undefined,
    soloInvalidos: f.soloInvalidos ? true : undefined,
    fecha1Desde: f.fecha1Desde || undefined,
    fecha1Hasta: f.fecha1Hasta || undefined,
    fecha2Desde: f.fecha2Desde || undefined,
    fecha2Hasta: f.fecha2Hasta || undefined,
    km1Min: num(f.km1Min),
    km1Max: num(f.km1Max),
    km2Min: num(f.km2Min),
    km2Max: num(f.km2Max),
    rd1Min: num(f.rd1Min),
    rd1Max: num(f.rd1Max),
    rd2Min: num(f.rd2Min),
    rd2Max: num(f.rd2Max),
    diferenciaKmMin: num(f.diferenciaKmMin),
    diferenciaKmMax: num(f.diferenciaKmMax),
    diferenciaRdMin: num(f.diferenciaRdMin),
    diferenciaRdMax: num(f.diferenciaRdMax),
    tasaMin: num(f.tasaMin),
    tasaMax: num(f.tasaMax),
    tasaMensualMin: num(f.tasaMensualMin),
    tasaMensualMax: num(f.tasaMensualMax),
    ejeNumeroMin: num(f.ejeNumeroMin),
    ejeNumeroMax: num(f.ejeNumeroMax),
  }
}
