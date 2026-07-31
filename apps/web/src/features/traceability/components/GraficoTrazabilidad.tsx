import { useMemo, useRef, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import type { ConsensoLimites, LimitesMetodo, PuntoSerieTrazabilidad } from '../types'
import {
  ANCHO,
  COLOR_EXTREMO_CONSENSO,
  COLOR_LIMITE_CONSENSO,
  COLOR_METODO,
  COLOR_NORMAL,
  COLOR_RECORTADO,
  MARGEN,
  calcularEscalaX,
  formatearFecha,
  minMax,
  nodoMasCercano,
  type Nodo,
} from './chart-shared'
import { ConsensoBandas } from './ConsensoBandas'
import { IndicadorExcluidos } from './IndicadorExcluidos'
import { TablaPuntosTrazabilidad } from './TablaPuntosTrazabilidad'

// GRÁFICO 1 — "Diagnóstico completo": TODO el detalle estadístico (puntos
// crudos normal/recortado, las 3 líneas de método, las 2 bandas de
// consenso). Los EXCLUIDOS nunca se dibujan acá como marcador — su valor
// crudo puede ser órdenes de magnitud más grande que el resto (son
// justamente eso: lo que quedó fuera del consenso de extremo) y deformarían
// el eje Y para todos los demás puntos. Se resumen en <IndicadorExcluidos>,
// fuera del área del gráfico. Ver GraficoTrazabilidadLimpia para la vista
// "solo lo que sí entra a la trazabilidad" (Gráfico 2).
const ALTO = 340
const N_TICKS_Y = 5

type Props = {
  puntos: PuntoSerieTrazabilidad[]
  gauss: LimitesMetodo
  percentiles: LimitesMetodo
  tukey: LimitesMetodo
  consenso: ConsensoLimites
  actualizando: boolean
  titulo: string
}

// Dominio Y: puntos normal/recortado visibles + el consenso de EXTREMO (para
// que las bandas de consenso siempre se vean completas) — los EXCLUIDOS
// nunca entran acá, es la corrección central de este gráfico. Tampoco entran
// los rangos crudos de cada método individual: Gauss es muy sensible a
// outliers reales y, si el dominio tuviera que abarcarlo, aplastaría toda la
// escala contra el eje — sus líneas de referencia simplemente se recortan
// fuera del área visible cuando eso pasa (el consenso ya existe para
// neutralizar ese caso).
function calcularGeometria(puntos: PuntoSerieTrazabilidad[], extremoConsenso: { inferior: number; superior: number }) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const fechasMs = puntos.map((p) => new Date(p.fecha).getTime())
  const { escalaX, xTicks, mostrarAnio } = calcularEscalaX(fechasMs, anchoUtil)

  const noExcluidos = puntos.filter((p) => p.estado !== 'excluido')
  const excluidos = puntos.filter((p) => p.estado === 'excluido')

  const valoresCrudos = noExcluidos.map((p) => p.tasaMensualCruda)
  const [minCrudo, maxCrudo] = minMax([...valoresCrudos, extremoConsenso.inferior, extremoConsenso.superior])
  const colchon = (maxCrudo - minCrudo || Math.abs(maxCrudo) || 1) * 0.12
  const min = minCrudo - colchon
  const max = maxCrudo + colchon
  const rango = max - min || 1
  const escalaY = (v: number) => MARGEN.top + altoUtil - ((v - min) / rango) * altoUtil

  const nodos: Nodo[] = noExcluidos.map((p) => ({
    x: escalaX(new Date(p.fecha).getTime()),
    y: escalaY(p.tasaMensualCruda),
    punto: p,
  }))

  const yTicks = Array.from({ length: N_TICKS_Y + 1 }, (_, i) => {
    const valor = min + (rango * i) / N_TICKS_Y
    return { valor, y: escalaY(valor) }
  })

  return { nodos, excluidos, yTicks, xTicks, mostrarAnio, escalaY }
}

export function GraficoTrazabilidad({ puntos, gauss, percentiles, tukey, consenso, actualizando, titulo }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [vistaTabla, setVistaTabla] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { nodos, excluidos, yTicks, xTicks, mostrarAnio, escalaY } = useMemo(
    () => calcularGeometria(puntos, consenso.extremoConsenso),
    [puntos, consenso.extremoConsenso],
  )

  const metodos = useMemo(
    () => [
      { clave: 'gauss', nombre: 'Gauss (±2σ)', limites: gauss, dash: undefined as string | undefined },
      { clave: 'percentiles', nombre: 'Percentiles (P5–P95)', limites: percentiles, dash: '5 4' },
      { clave: 'tukey', nombre: 'Tukey (±1.5×IQR)', limites: tukey, dash: '1.5 3.5' },
    ],
    [gauss, percentiles, tukey],
  )

  function alMoverMouse(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current
    if (!svg || nodos.length === 0) return
    const rect = svg.getBoundingClientRect()
    const xSvg = ((e.clientX - rect.left) / rect.width) * ANCHO
    setHover(nodoMasCercano(nodos, xSvg))
  }

  const nodoHover = hover !== null ? nodos[hover] : null

  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-concreto-oscuro">Diagnóstico completo</h3>
          <p className="mt-0.5 font-body text-xs text-concreto">{titulo} · mm/mes</p>
        </div>
        <button
          type="button"
          onClick={() => setVistaTabla((v) => !v)}
          className="rounded-full border border-concreto/30 px-3 py-1.5 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60"
        >
          {vistaTabla ? 'Ver como gráfico' : 'Ver como tabla'}
        </button>
      </div>

      <div className="mt-2">
        <IndicadorExcluidos puntos={excluidos} />
      </div>

      {vistaTabla ? (
        <TablaPuntosTrazabilidad puntos={puntos} />
      ) : (
        <>
          <div
            className="relative h-[340px] w-full transition-opacity duration-300"
            style={{ opacity: actualizando ? 0.55 : 1 }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              role="img"
              aria-label={`Diagnóstico completo de trazabilidad — ${titulo}`}
            >
              {/* grid Y */}
              {yTicks.map((t) => (
                <g key={t.valor}>
                  <line
                    x1={MARGEN.left}
                    x2={ANCHO - MARGEN.right}
                    y1={t.y}
                    y2={t.y}
                    stroke="rgba(140,137,127,0.18)"
                    strokeWidth={1}
                  />
                  <text
                    x={MARGEN.left - 8}
                    y={t.y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    fill="var(--color-gris-concreto)"
                    className="font-data"
                  >
                    {t.valor.toFixed(4)}
                  </text>
                </g>
              ))}

              {/* etiquetas X */}
              {xTicks.map((t) => (
                <text
                  key={t.ms}
                  x={t.x}
                  y={ALTO - MARGEN.bottom + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-gris-concreto)"
                  className="font-body"
                >
                  {formatearFecha(t.ms, mostrarAnio)}
                </text>
              ))}

              <ConsensoBandas
                consenso={consenso}
                escalaY={escalaY}
                x={MARGEN.left}
                ancho={ANCHO - MARGEN.left - MARGEN.right}
              />

              {/* líneas de referencia por método (límite inferior/superior) —
                  gris neutro, diferenciadas por trazo, nunca por color: son
                  contexto secundario frente al consenso. */}
              {metodos.map((m) => (
                <g key={m.clave} opacity={0.55}>
                  <line
                    x1={MARGEN.left}
                    x2={ANCHO - MARGEN.right}
                    y1={escalaY(m.limites.limiteInferior)}
                    y2={escalaY(m.limites.limiteInferior)}
                    stroke={COLOR_METODO}
                    strokeWidth={1.25}
                    strokeDasharray={m.dash}
                  />
                  <line
                    x1={MARGEN.left}
                    x2={ANCHO - MARGEN.right}
                    y1={escalaY(m.limites.limiteSuperior)}
                    y2={escalaY(m.limites.limiteSuperior)}
                    stroke={COLOR_METODO}
                    strokeWidth={1.25}
                    strokeDasharray={m.dash}
                  />
                </g>
              ))}

              {/* puntos crudos, coloreados por estado (normal/recortado — los
                  excluidos ya no llegan a `nodos`, ver IndicadorExcluidos) */}
              {nodos.map((n, i) => {
                const color = n.punto.estado === 'recortado' ? COLOR_RECORTADO : COLOR_NORMAL
                return (
                  <circle
                    key={n.punto.fecha + i}
                    cx={n.x}
                    cy={n.y}
                    r={hover === i ? 4.5 : 3}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={1.25}
                  />
                )
              })}

              {/* crosshair + hit-area única (arriba de todo) */}
              {nodoHover && (
                <line
                  x1={nodoHover.x}
                  x2={nodoHover.x}
                  y1={MARGEN.top}
                  y2={ALTO - MARGEN.bottom}
                  stroke="var(--color-gris-concreto)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              )}
              <rect
                x={MARGEN.left}
                y={MARGEN.top}
                width={ANCHO - MARGEN.left - MARGEN.right}
                height={ALTO - MARGEN.top - MARGEN.bottom}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseMove={alMoverMouse}
                onMouseLeave={() => setHover(null)}
              />
            </svg>

            {nodoHover && <TooltipPunto nodo={nodoHover} />}

            {puntos.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="rounded-full bg-white/70 px-4 py-2 font-body text-sm text-concreto-oscuro">
                  Sin mediciones en el periodo seleccionado — probá "Todo" para ver el histórico completo.
                </p>
              </div>
            )}
          </div>

          <Leyenda metodos={metodos} />
        </>
      )}
    </GlassSurface>
  )
}

function TooltipPunto({ nodo }: { nodo: Nodo }) {
  const { punto } = nodo
  const izquierda = Math.min(92, Math.max(8, (nodo.x / ANCHO) * 100))
  const etiquetaEstado = punto.estado === 'normal' ? 'Normal' : 'Recortado'
  const colorEstado = punto.estado === 'normal' ? COLOR_NORMAL : COLOR_RECORTADO

  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: `${izquierda}%`,
        top: nodo.y,
        transform: 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      <div className="glass-surface glass-surface--strong min-w-[11rem] rounded-2xl px-3 py-2.5">
        <p className="font-body text-xs font-semibold text-concreto-oscuro">{punto.fecha}</p>
        <p className="mt-0.5 font-data text-sm text-concreto-oscuro">{punto.tasaMensualCruda.toFixed(6)} mm/mes</p>
        <p className="mt-1 flex items-center gap-1.5 font-body text-[0.6875rem] text-concreto">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: colorEstado }} />
          {etiquetaEstado}
          {punto.estado === 'recortado' && punto.valorLimpio !== null && (
            <span className="font-data">· limpio {punto.valorLimpio.toFixed(6)}</span>
          )}
        </p>
      </div>
    </div>
  )
}

function Leyenda({ metodos }: { metodos: { clave: string; nombre: string; dash?: string }[] }) {
  return (
    <div className="mt-4 space-y-2.5 border-t border-concreto/15 pt-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <LeyendaPunto color={COLOR_NORMAL} etiqueta="Normal" />
        <LeyendaPunto color={COLOR_RECORTADO} etiqueta="Recortado" />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {metodos.map((m) => (
          <LeyendaLinea key={m.clave} color={COLOR_METODO} dash={m.dash} etiqueta={m.nombre} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <LeyendaBanda color={COLOR_LIMITE_CONSENSO} etiqueta="Consenso — límite" />
        <LeyendaBanda color={COLOR_EXTREMO_CONSENSO} dash="4 3" etiqueta="Consenso — extremo" />
      </div>
    </div>
  )
}

function LeyendaLinea({ color, dash, etiqueta }: { color: string; dash?: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 font-body text-[0.6875rem] text-concreto-oscuro">
      <svg width={20} height={8} aria-hidden>
        <line x1={0} y1={4} x2={20} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dash} />
      </svg>
      {etiqueta}
    </span>
  )
}

function LeyendaPunto({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 font-body text-[0.6875rem] text-concreto-oscuro">
      <svg width={10} height={10} aria-hidden>
        <circle cx={5} cy={5} r={4} fill={color} stroke="#fff" strokeWidth={1} />
      </svg>
      {etiqueta}
    </span>
  )
}

function LeyendaBanda({ color, dash, etiqueta }: { color: string; dash?: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 font-body text-[0.6875rem] text-concreto-oscuro">
      <svg width={20} height={12} aria-hidden>
        <rect x={0} y={1} width={20} height={10} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
      </svg>
      {etiqueta}
    </span>
  )
}
