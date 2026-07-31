// Piezas compartidas entre los 2 gráficos de trazabilidad (GraficoTrazabilidad
// "Diagnóstico completo" y GraficoTrazabilidadLimpia "Trazabilidad limpia"):
// mismo ancho/márgenes (para que las fechas alineen verticalmente si se leen
// apilados), misma paleta, mismas utilidades de escala/interacción.
import type { PuntoSerieTrazabilidad } from '../types'

export const ANCHO = 760
export const MARGEN = { top: 20, right: 20, bottom: 40, left: 68 }
export const N_TICKS_X = 6

export const COLOR_NORMAL = 'var(--color-verde-institucional)'
export const COLOR_RECORTADO = 'var(--color-estado-seguimiento)'
export const COLOR_EXCLUIDO = 'var(--color-estado-critico)'
export const COLOR_METODO = 'var(--color-gris-concreto-oscuro)'
export const COLOR_LIMITE_CONSENSO = COLOR_NORMAL
export const COLOR_EXTREMO_CONSENSO = COLOR_RECORTADO

export type Nodo = { x: number; y: number; punto: PuntoSerieTrazabilidad }

export function minMax(valores: number[]): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const v of valores) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return [min, max]
}

// Búsqueda binaria por X: los nodos vienen ordenados por fecha (el backend
// los devuelve orderBy fecha2 asc) — con miles de puntos (scope global,
// periodo "todo"), un solo listener de mousemove + búsqueda binaria escala
// mucho mejor que un hit-area por punto.
export function nodoMasCercano(nodos: { x: number }[], xObjetivo: number): number {
  if (nodos.length === 0) return -1
  let lo = 0
  let hi = nodos.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (nodos[mid].x < xObjetivo) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(nodos[lo - 1].x - xObjetivo) < Math.abs(nodos[lo].x - xObjetivo)) return lo - 1
  return lo
}

export function formatearFecha(ms: number, conAnio: boolean): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: conAnio ? '2-digit' : undefined,
  }).format(new Date(ms))
}

// "mon año" (ej. "ene 2026") — eje X, tooltip y tabla del Gráfico 2 cuando
// agregacionAplicada='mensual': a esa resolución ya no tiene sentido mostrar
// el día, a diferencia de formatearFecha (puntos crudos, resolución diaria).
export function formatearMesDesdeMs(ms: number): string {
  return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(new Date(ms))
}

// PuntoMensualTrazabilidad.mes viene como "YYYY-MM" (ver PuntoMensualApi en
// el backend) — se ancla al día 1 para ubicarlo en la escala X compartida
// (calcularEscalaX) y para reusar formatearMesDesdeMs. Construye la fecha con
// componentes locales (new Date(año, mes, día), NO new Date("YYYY-MM-DD")):
// un string ISO sin hora se parsea como medianoche UTC, y formatearMesDesdeMs
// formatea en timezone local — en cualquier huso detrás de UTC (Lima es
// UTC-5) esa combinación corre la fecha un mes para atrás (ej. "2024-06" se
// mostraba "may. 2024"). Mismo patrón ya usado en GraficoTasaMensual
// (wear-rate) por esta misma razón.
export function msDesdeMes(mes: string): number {
  const [anio, mesNum] = mes.split('-').map(Number)
  return new Date(anio, mesNum - 1, 1).getTime()
}

// Curva suave (Catmull-Rom → Bezier cúbica, tensión uniforme) para series con
// pocos puntos espaciados (ej. tendencia mensual), donde una polilínea recta
// (M...L...L) se ve angulosa/zigzagueante — NO se usa para la serie cruda
// densa (ahí la polilínea recta es correcta: cada segmento es información
// real punto a punto, suavizarla inventaría curvatura entre mediciones
// consecutivas que no existe).
export function pathSuave(nodos: { x: number; y: number }[]): string {
  if (nodos.length === 0) return ''
  if (nodos.length < 3) {
    return nodos.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')
  }
  const d = [`M ${nodos[0].x.toFixed(1)} ${nodos[0].y.toFixed(1)}`]
  for (let i = 0; i < nodos.length - 1; i++) {
    const p0 = nodos[i - 1] ?? nodos[i]
    const p1 = nodos[i]
    const p2 = nodos[i + 1]
    const p3 = nodos[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
  }
  return d.join(' ')
}

// Dominio X compartido: SIEMPRE a partir de TODAS las fechas del tramo (los
// dos gráficos comparten el mismo periodo/scope) — así el eje X de ambos
// gráficos queda alineado aunque cada uno decida qué puntos Y graficar.
export function calcularEscalaX(fechasMs: number[], anchoUtil: number) {
  const [fechaMin, fechaMax] = fechasMs.length ? minMax(fechasMs) : [Date.now() - 1, Date.now()]
  const rangoFechas = fechaMax - fechaMin || 1
  const escalaX = (ms: number) => MARGEN.left + ((ms - fechaMin) / rangoFechas) * anchoUtil

  const xTicks = Array.from({ length: N_TICKS_X + 1 }, (_, i) => {
    const ms = fechaMin + (rangoFechas * i) / N_TICKS_X
    return { ms, x: escalaX(ms) }
  })

  const mostrarAnio = rangoFechas > 1000 * 60 * 60 * 24 * 340

  return { escalaX, xTicks, mostrarAnio }
}
