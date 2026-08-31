import type { PuntoCambiosRealesMes, PuntoRetirosMes } from '../../inventory/types'
import type { PronosticoMes } from '../../projection/types'

// Geometría y transformación de datos compartidas entre GraficoConsumoDiscos
// y GraficoConsumoDiscosAcumulado.tsx — separado de los componentes porque
// Fast Refresh exige que un archivo .tsx solo exporte componentes.
export const ANCHO_CONSUMO = 900
export const ALTO_CONSUMO = 300
export const MARGEN_CONSUMO = { top: 24, right: 24, bottom: 40, left: 48 }

export const pctXConsumo = (x: number) => (x / ANCHO_CONSUMO) * 100
export const pctYConsumo = (y: number) => (y / ALTO_CONSUMO) * 100

export type PuntoConsumo = {
  mes: string
  proyectados: number
  reales: number
  retirados: number
}

export type ClaveSerieConsumo = 'proyectados' | 'reales' | 'retirados'

export const SERIES_CONSUMO: { clave: ClaveSerieConsumo; etiqueta: string; color: string }[] = [
  { clave: 'proyectados', etiqueta: 'Proyectados', color: 'var(--color-estado-cambio)' },
  { clave: 'reales', etiqueta: 'Cambiados (reales)', color: 'var(--color-verde-institucional)' },
  { clave: 'retirados', etiqueta: 'Retirados de Almacén', color: 'var(--color-gris-concreto-oscuro)' },
]

// Une, por mes calendario (ene-dic del año en curso), retiros reales +
// cambios reales + proyección. Para meses YA TRANSCURRIDOS del año,
// "proyectados" usa el mismo valor que "reales" de ese mes como proxy: la
// proyección (/projection/pronostico) es siempre una ventana desde HOY hacia
// adelante, nunca reconstruye qué se proyectaba en una fecha pasada.
export function combinarConsumo(
  retirados: PuntoRetirosMes[],
  reales: PuntoCambiosRealesMes[],
  proyeccion: PronosticoMes[],
): PuntoConsumo[] {
  const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const mapaReales = new Map(reales.map((p) => [p.mes, p.cambiosReales]))
  const mapaProyeccion = new Map(proyeccion.map((p) => [p.mes, p.cambios]))

  return retirados
    .map((r) => {
      const realesVal = mapaReales.get(r.mes) ?? 0
      const proyectadosVal = r.mes < mesActual ? realesVal : (mapaProyeccion.get(r.mes) ?? 0)
      return { mes: r.mes, proyectados: proyectadosVal, reales: realesVal, retirados: r.retirados }
    })
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

// Ejemplo del usuario: lo de Marzo es "lo de Marzo + lo de Enero" — suma
// corrida mes a mes, aplicada a cada serie por separado.
export function acumularConsumo(datos: PuntoConsumo[]): PuntoConsumo[] {
  let acumProyectados = 0
  let acumReales = 0
  let acumRetirados = 0
  return datos.map((d) => {
    acumProyectados += d.proyectados
    acumReales += d.reales
    acumRetirados += d.retirados
    return { mes: d.mes, proyectados: acumProyectados, reales: acumReales, retirados: acumRetirados }
  })
}

export function formatearMesConsumo(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number)
  if (!anio || !mesNum) return mes
  return new Date(anio, mesNum - 1, 1).toLocaleDateString('es-PE', { month: 'short' })
}

export function calcularGeometriaConsumo(datos: PuntoConsumo[]) {
  const anchoUtil = ANCHO_CONSUMO - MARGEN_CONSUMO.left - MARGEN_CONSUMO.right
  const altoUtil = ALTO_CONSUMO - MARGEN_CONSUMO.top - MARGEN_CONSUMO.bottom

  const valores = datos.flatMap((d) => SERIES_CONSUMO.map((s) => d[s.clave]))
  const max = valores.length ? Math.max(1, ...valores) : 1

  const escalaX = (i: number) =>
    datos.length > 1 ? MARGEN_CONSUMO.left + (i / (datos.length - 1)) * anchoUtil : MARGEN_CONSUMO.left + anchoUtil / 2
  const escalaY = (v: number) => MARGEN_CONSUMO.top + altoUtil - (v / max) * altoUtil

  const series = SERIES_CONSUMO.map((serie) => {
    const nodos = datos.map((d, i) => ({ x: escalaX(i), y: escalaY(d[serie.clave]), valor: d[serie.clave] }))
    const path = nodos.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')
    return { ...serie, nodos, path }
  })

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const valor = Math.round((max * i) / 4)
    return { valor, y: escalaY(valor) }
  })
  const xs = datos.map((_, i) => escalaX(i))

  return { series, ticks, xs }
}
