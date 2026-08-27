import { Info, PackageSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { PuntoRetirosMes } from '../../inventory/types'
import type { PronosticoMes } from '../../projection/types'

// Gráfico de líneas (no de barras) — mismo criterio SVG propio que
// GraficoTasaPorCoche.tsx, adaptado a 3 series con huecos: cada una solo
// tiene datos de SU mitad del eje (pasado o futuro), unidas en el mes pivote.
//
// TODO EL TEXTO vive fuera del <svg>, en un overlay HTML posicionado por
// porcentaje (pctX/pctY) — ver el comentario grande en GraficoTasaPorCoche.tsx:
// con preserveAspectRatio="none" el svg escala X/Y distinto y deforma
// cualquier <text> que viva adentro ("aplastado"); el overlay HTML nunca se
// deforma así. El overlay y el svg comparten el mismo div interno
// `min-w-[46rem]` (no el contenedor con overflow-x-auto de afuera), para que
// las posiciones en % sigan coincidiendo también cuando el gráfico scrollea
// en pantallas angostas.
const ANCHO = 900
const ALTO = 300
const MARGEN = { top: 24, right: 24, bottom: 40, left: 48 }

const pctX = (x: number) => (x / ANCHO) * 100
const pctY = (y: number) => (y / ALTO) * 100

type PuntoFlujo = {
  mes: string
  retirados: number | null
  cambiosProyectados: number | null
  reperfiladosProyectados: number | null
}

type ClaveSerie = 'retirados' | 'cambiosProyectados' | 'reperfiladosProyectados'

// Une la serie PASADA (retiros reales de Almacén, InventoryMovement — ya
// viene con los 12 meses de enero a diciembre del año en curso, ver
// InventoryService.obtenerRetirosPorMes) con la serie FUTURA (Cambio/
// Reperfilado proyectados, /projection/pronostico-12-meses, que es una
// ventana móvil desde HOY hacia adelante, no calendario) — se recorta esa
// ventana a solo los meses que caen en el año en curso, para no arrastrar
// meses del año próximo. El mes en curso aparece en ambas fuentes
// (retiros.mes[actual] === pronostico.mes[0]) y se fusiona en un único punto
// con las 3 series pobladas, en vez de duplicar esa columna.
function combinarFlujo(pasado: PuntoRetirosMes[], futuro: PronosticoMes[]): PuntoFlujo[] {
  const anioActual = String(new Date().getFullYear())
  const mapa = new Map<string, PuntoFlujo>()
  for (const p of pasado) {
    mapa.set(p.mes, { mes: p.mes, retirados: p.retirados, cambiosProyectados: null, reperfiladosProyectados: null })
  }
  for (const f of futuro) {
    if (!f.mes.startsWith(anioActual)) continue
    const existente = mapa.get(f.mes)
    if (existente) {
      existente.cambiosProyectados = f.cambios
      existente.reperfiladosProyectados = f.reperfilados
    } else {
      mapa.set(f.mes, { mes: f.mes, retirados: null, cambiosProyectados: f.cambios, reperfiladosProyectados: f.reperfilados })
    }
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

function formatearMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number)
  if (!anio || !mesNum) return mes
  return new Date(anio, mesNum - 1, 1).toLocaleDateString('es-PE', { month: 'short' })
}

const SERIES: { clave: ClaveSerie; etiqueta: string; color: string }[] = [
  { clave: 'retirados', etiqueta: 'Discos retirados de Almacén', color: 'var(--color-verde-institucional)' },
  { clave: 'cambiosProyectados', etiqueta: 'Cambio de discos proyectados', color: 'var(--color-estado-cambio)' },
  { clave: 'reperfiladosProyectados', etiqueta: 'Reperfilados de discos proyectados', color: 'var(--color-estado-reperfilado)' },
]

function calcularGeometria(datos: PuntoFlujo[]) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const valores = datos.flatMap((d) => SERIES.map((s) => d[s.clave]).filter((v): v is number => v !== null))
  const max = valores.length ? Math.max(1, ...valores) : 1

  const escalaX = (i: number) =>
    datos.length > 1 ? MARGEN.left + (i / (datos.length - 1)) * anchoUtil : MARGEN.left + anchoUtil / 2
  const escalaY = (v: number) => MARGEN.top + altoUtil - (v / max) * altoUtil

  const series = SERIES.map((serie) => {
    const nodos = datos.map((d, i) => ({
      x: escalaX(i),
      y: d[serie.clave] !== null ? escalaY(d[serie.clave] as number) : null,
      valor: d[serie.clave],
    }))
    const conValor = nodos.filter((n): n is { x: number; y: number; valor: number } => n.y !== null)
    const path = conValor.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')
    return { ...serie, nodos, path }
  })

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const valor = Math.round((max * i) / 4)
    return { valor, y: escalaY(valor) }
  })
  const xs = datos.map((_, i) => escalaX(i))

  return { series, ticks, xs }
}

type Props = {
  pasado?: PuntoRetirosMes[]
  futuro?: PronosticoMes[]
  cargando: boolean
  mesActual: string
}

export function GraficoFlujoMensualDiscos({ pasado, futuro, cargando, mesActual }: Props) {
  const [activo, setActivo] = useState<number | null>(null)
  const datos = useMemo(() => combinarFlujo(pasado ?? [], futuro ?? []), [pasado, futuro])
  const { series, ticks, xs } = useMemo(() => calcularGeometria(datos), [datos])
  const indicePivote = datos.findIndex((d) => d.mes === mesActual)
  const xPivote = indicePivote >= 0 ? xs[indicePivote] : null

  return (
    <GlassSurface fuerte className="rounded-glass p-5">
      <div className="mb-0.5 flex items-center gap-1.5">
        <PackageSearch size={16} className="text-concreto-oscuro" aria-hidden />
        <h3 className="font-display text-base font-semibold text-concreto-oscuro">Flujo mensual de discos</h3>
        <WarningTooltip texto="Enero a diciembre del año en curso. Meses pasados: retiros reales de Almacén. Mes actual en adelante: cambios y reperfilados proyectados.">
          <Info size={14} className="text-concreto" aria-label="Más información" />
        </WarningTooltip>
      </div>
      <p className="mb-3 font-body text-xs text-concreto">
        Meses pasados: retiros reales de Almacén · meses futuros: cambios y reperfilados proyectados
      </p>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 font-body text-xs text-concreto">
        {SERIES.map((serie) => (
          <span key={serie.clave} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: serie.color }} />
            {serie.etiqueta}
          </span>
        ))}
      </div>

      {cargando ? (
        <div className="flex h-[300px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Cargando gráfico…</p>
        </div>
      ) : datos.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Sin datos suficientes para graficar.</p>
        </div>
      ) : (
        <div className="h-[300px] w-full overflow-x-auto">
          <div className="relative h-full min-w-[46rem]">
            <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Flujo mensual de discos">
              {ticks.map((t) => (
                <line key={t.valor} x1={MARGEN.left} x2={ANCHO - MARGEN.right} y1={t.y} y2={t.y} stroke="rgba(140,137,127,0.18)" />
              ))}

              {xPivote !== null && (
                <line x1={xPivote} x2={xPivote} y1={MARGEN.top} y2={ALTO - MARGEN.bottom} stroke="rgba(140,137,127,0.4)" strokeDasharray="4 3" />
              )}

              {series.map((serie) => (
                <path key={serie.clave} d={serie.path} fill="none" stroke={serie.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}

              {series.map((serie) =>
                serie.nodos.map(
                  (n, i) =>
                    n.y !== null && (
                      <circle key={`${serie.clave}-${i}`} cx={n.x} cy={n.y} r={activo === i ? 5 : 3} fill={serie.color} stroke="#fff" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                    ),
                ),
              )}

              {datos.map((d, i) => (
                <rect
                  key={`hover-${d.mes}`}
                  x={xs[i] - ANCHO / Math.max(datos.length, 1) / 2}
                  y={MARGEN.top}
                  width={ANCHO / Math.max(datos.length, 1)}
                  height={ALTO - MARGEN.top - MARGEN.bottom}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo((h) => (h === i ? null : h))}
                />
              ))}
            </svg>

            <div className="pointer-events-none absolute inset-0">
              {ticks.map((t) => (
                <span
                  key={t.valor}
                  className="absolute font-data text-[10px]"
                  style={{ left: `${pctX(MARGEN.left - 8)}%`, top: `${pctY(t.y)}%`, transform: 'translate(-100%, -50%)', color: 'var(--color-gris-concreto)' }}
                >
                  {t.valor}
                </span>
              ))}

              {datos.map((d, i) => (
                <span
                  key={`x-${d.mes}`}
                  className="absolute whitespace-nowrap font-body text-[10px]"
                  style={{ left: `${pctX(xs[i])}%`, top: `${pctY(ALTO - MARGEN.bottom + 18)}%`, transform: 'translate(-50%, -50%)', color: 'var(--color-gris-concreto)' }}
                >
                  {formatearMes(d.mes)}
                </span>
              ))}

              {xPivote !== null && (
                <span
                  className="absolute font-body text-[9px] font-semibold uppercase tracking-wide"
                  style={{ left: `${pctX(xPivote)}%`, top: `${pctY(MARGEN.top - 8)}%`, transform: 'translate(-50%, -50%)', color: 'var(--color-gris-concreto)' }}
                >
                  Hoy
                </span>
              )}

              {series.map((serie) =>
                serie.nodos.map(
                  (n, i) =>
                    n.y !== null &&
                    n.valor !== null &&
                    n.valor > 0 && (
                      <span
                        key={`etiqueta-${serie.clave}-${i}`}
                        className="absolute whitespace-nowrap font-data text-[10px] font-semibold"
                        style={{ left: `${pctX(n.x)}%`, top: `${pctY(n.y - 12)}%`, transform: 'translate(-50%, -50%)', color: serie.color }}
                      >
                        {n.valor}
                      </span>
                    ),
                ),
              )}
            </div>

            {activo !== null && datos[activo] && <TooltipMes punto={datos[activo]} x={xs[activo]} />}
          </div>
        </div>
      )}
    </GlassSurface>
  )
}

function TooltipMes({ punto, x }: { punto: PuntoFlujo; x: number }) {
  const izquierda = Math.min(88, Math.max(12, pctX(x)))
  return (
    <div className="pointer-events-none absolute z-10 top-2" style={{ left: `${izquierda}%`, transform: 'translateX(-50%)' }}>
      <div className="glass-surface glass-surface--strong min-w-[13rem] rounded-2xl px-3 py-2.5">
        <p className="font-body text-xs font-semibold capitalize text-concreto-oscuro">{formatearMes(punto.mes)}</p>
        <dl className="mt-1 space-y-0.5">
          {SERIES.map((serie) => (
            <div key={serie.clave} className="flex items-center justify-between gap-3 font-data text-[0.6875rem]">
              <dt className="flex items-center gap-1.5 text-concreto">
                <span className="h-2 w-2 rounded-sm" style={{ background: serie.color }} />
                {serie.etiqueta}
              </dt>
              <dd className="font-semibold text-concreto-oscuro">
                {punto[serie.clave] !== null ? punto[serie.clave] : '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
