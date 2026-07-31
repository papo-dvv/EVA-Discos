import { useMemo, useRef, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import type {
  ConsensoLimites,
  PuntoMensualTrazabilidad,
  PuntoSerieTrazabilidad,
  TraceabilitySeriesResult,
} from '../types'
import {
  ANCHO,
  COLOR_EXTREMO_CONSENSO,
  COLOR_LIMITE_CONSENSO,
  COLOR_NORMAL,
  MARGEN,
  calcularEscalaX,
  formatearFecha,
  formatearMesDesdeMs,
  minMax,
  msDesdeMes,
  nodoMasCercano,
  pathSuave,
  type Nodo,
} from './chart-shared'
import { ConsensoBandas } from './ConsensoBandas'
import { TablaPuntosMensualesTrazabilidad } from './TablaPuntosMensualesTrazabilidad'
import { TablaPuntosTrazabilidad } from './TablaPuntosTrazabilidad'

// GRÁFICO 2 — "Trazabilidad limpia": la vista de tendencia, no de auditoría.
// Sin las 3 líneas de método (ya están en el Gráfico 1, acá sobran) — solo
// los 2 "rieles" de consenso (límite y extremo) conteniendo la data. Grafica
// ÚNICAMENTE normal + recortado, siempre con valorLimpio (nunca el valor
// crudo) — los excluidos no aparecen ni como marcador ni como indicador acá,
// a diferencia del Gráfico 1: este gráfico es exclusivamente sobre lo que SÍ
// entra a la trazabilidad. Sin distinción de color entre normal/recortado a
// propósito — es una sola línea de tendencia, no una auditoría punto por
// punto.
//
// A diferencia del Gráfico 1 (siempre agregacion='crudo'), este pide
// agregacion='auto': con volumen alto de puntos el backend agrupa por mes
// (agregacionAplicada='mensual') y acá se dibuja como una línea suave de
// baja densidad; con poco volumen el backend devuelve crudo
// (agregacionAplicada='crudo', ver TraceabilitySeriesResult en el backend)
// y acá se mantiene el comportamiento punto-a-punto de siempre —
// agregar por mes un puñado de puntos perdería información en vez de
// limpiar ruido. El indicador bajo el título hace explícito cuál de los 2
// modos está activo, para que el cambio de aspecto entre scopes/periodos no
// se lea como un bug.
const ALTO = 280
const N_TICKS_Y = 4

// `resultado` viaja como UN solo objeto (no desarmado en props sueltas) a
// propósito: es la unión discriminada TraceabilitySeriesResult tal cual la
// devuelve useTraceabilitySeries, y TypeScript solo puede seguir
// correlacionando agregacionAplicada con la forma de `puntos` si ambos se
// leen de la MISMA referencia — pasarlos como dos props independientes
// (agregacionAplicada={...} puntos={...}) le hace perder el vínculo entre
// ambos y deja de compilar.
type Props = {
  resultado: TraceabilitySeriesResult
  actualizando: boolean
  titulo: string
}

export function GraficoTrazabilidadLimpia({ resultado, actualizando, titulo }: Props) {
  const [vistaTabla, setVistaTabla] = useState(false)
  const { consenso, agregacionAplicada } = resultado
  const esMensual = agregacionAplicada === 'mensual'

  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-concreto-oscuro">Trazabilidad limpia</h3>
            <span className="rounded-full border border-concreto/25 px-2 py-0.5 font-body text-[0.6875rem] text-concreto">
              {esMensual ? 'Vista mensual (agregado)' : 'Vista detallada (dato por dato)'}
            </span>
          </div>
          <p className="mt-0.5 font-body text-xs text-concreto">
            {titulo} · mm/mes · solo puntos dentro del consenso (valor limpio)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVistaTabla((v) => !v)}
          className="rounded-full border border-concreto/30 px-3 py-1.5 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60"
        >
          {vistaTabla ? 'Ver como gráfico' : 'Ver como tabla'}
        </button>
      </div>

      {vistaTabla ? (
        resultado.agregacionAplicada === 'mensual' ? (
          <TablaPuntosMensualesTrazabilidad puntos={resultado.puntos} />
        ) : (
          <TablaPuntosTrazabilidad puntos={resultado.puntos.filter((p) => p.valorLimpio !== null)} />
        )
      ) : (
        <>
          {resultado.agregacionAplicada === 'mensual' ? (
            <GraficoSvgMensual puntos={resultado.puntos} consenso={consenso} actualizando={actualizando} titulo={titulo} />
          ) : (
            <GraficoSvgCrudo puntos={resultado.puntos} consenso={consenso} actualizando={actualizando} titulo={titulo} />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-concreto/15 pt-3">
            <LeyendaLinea color={COLOR_NORMAL} etiqueta="Trazabilidad limpia (valor limpio)" />
            <LeyendaBanda color={COLOR_LIMITE_CONSENSO} etiqueta="Riel de consenso — límite" />
            <LeyendaBanda color={COLOR_EXTREMO_CONSENSO} dash="4 3" etiqueta="Riel de consenso — extremo" />
          </div>
        </>
      )}
    </GlassSurface>
  )
}

// ---------------------------------------------------------------------------
// Modo crudo (agregacionAplicada='crudo') — comportamiento sin cambios:
// polilínea recta punto a punto, valorLimpio de normal+recortado.
// ---------------------------------------------------------------------------

type PropsCrudo = {
  puntos: PuntoSerieTrazabilidad[]
  consenso: ConsensoLimites
  actualizando: boolean
  titulo: string
}

// Dominio Y: valorLimpio de los puntos incluidos (normal/recortado) + el
// consenso de extremo, para que los 2 rieles siempre se vean completos.
function calcularGeometriaCrudo(puntos: PuntoSerieTrazabilidad[], consenso: ConsensoLimites) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const fechasMs = puntos.map((p) => new Date(p.fecha).getTime())
  const { escalaX, xTicks, mostrarAnio } = calcularEscalaX(fechasMs, anchoUtil)

  // valorLimpio es null EXACTAMENTE cuando el punto está excluido (ver
  // clasificarYLimpiarSerie en el backend) — este filtro es, por
  // construcción, "normal + recortado" y de paso le prueba a TS que
  // valorLimpio ya no es null en `incluidos`.
  const incluidos = puntos.filter(
    (p): p is PuntoSerieTrazabilidad & { valorLimpio: number } => p.valorLimpio !== null,
  )

  const valoresLimpios = incluidos.map((p) => p.valorLimpio)
  const [minLimpio, maxLimpio] = minMax([
    ...valoresLimpios,
    consenso.extremoConsenso.inferior,
    consenso.extremoConsenso.superior,
  ])
  const colchon = (maxLimpio - minLimpio || Math.abs(maxLimpio) || 1) * 0.12
  const min = minLimpio - colchon
  const max = maxLimpio + colchon
  const rango = max - min || 1
  const escalaY = (v: number) => MARGEN.top + altoUtil - ((v - min) / rango) * altoUtil

  const nodos: Nodo[] = incluidos.map((p) => ({
    x: escalaX(new Date(p.fecha).getTime()),
    y: escalaY(p.valorLimpio),
    punto: p,
  }))

  // Sin huecos: ya se filtraron los excluidos, todo nodo tiene valor. Recta
  // punto a punto a propósito (sin pathSuave): cada segmento es una medición
  // real, suavizarlo inventaría curvatura entre puntos consecutivos.
  const path = nodos.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')

  const yTicks = Array.from({ length: N_TICKS_Y + 1 }, (_, i) => {
    const valor = min + (rango * i) / N_TICKS_Y
    return { valor, y: escalaY(valor) }
  })

  return { nodos, path, yTicks, xTicks, mostrarAnio, escalaY }
}

function GraficoSvgCrudo({ puntos, consenso, actualizando, titulo }: PropsCrudo) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { nodos, path, yTicks, xTicks, mostrarAnio, escalaY } = useMemo(
    () => calcularGeometriaCrudo(puntos, consenso),
    [puntos, consenso],
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
    <div
      className="relative w-full transition-opacity duration-300"
      style={{ height: ALTO, opacity: actualizando ? 0.55 : 1 }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Trazabilidad limpia (vista detallada) — ${titulo}`}
      >
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

        {/* los 2 "rieles" de consenso — únicas bandas de este gráfico */}
        <ConsensoBandas
          consenso={consenso}
          escalaY={escalaY}
          x={MARGEN.left}
          ancho={ANCHO - MARGEN.left - MARGEN.right}
        />

        {path && (
          <path d={path} fill="none" stroke={COLOR_NORMAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* puntos, sin distinción normal/recortado a propósito */}
        {nodos.map((n, i) => (
          <circle
            key={`crudo-${i}`}
            cx={n.x}
            cy={n.y}
            r={hover === i ? 4 : 2.5}
            fill={COLOR_NORMAL}
            stroke="#fff"
            strokeWidth={1.25}
          />
        ))}

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

      {nodoHover && <TooltipCrudo nodo={nodoHover} />}

      {nodos.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/70 px-4 py-2 font-body text-sm text-concreto-oscuro">
            Sin puntos dentro del consenso en el periodo seleccionado.
          </p>
        </div>
      )}
    </div>
  )
}

function TooltipCrudo({ nodo }: { nodo: Nodo }) {
  const { punto } = nodo
  const izquierda = Math.min(92, Math.max(8, (nodo.x / ANCHO) * 100))
  const difiereDelCrudo = punto.valorLimpio !== null && Math.abs(punto.valorLimpio - punto.tasaMensualCruda) > 1e-9

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
        <p className="mt-0.5 font-data text-sm text-verde-oscuro">{punto.valorLimpio?.toFixed(6)} mm/mes</p>
        {difiereDelCrudo && (
          <p className="mt-1 font-body text-[0.6875rem] text-concreto">
            crudo: <span className="font-data">{punto.tasaMensualCruda.toFixed(6)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modo mensual (agregacionAplicada='mensual') — línea suave de baja densidad,
// un punto por mes (promedioValorLimpio).
// ---------------------------------------------------------------------------

type PropsMensual = {
  puntos: PuntoMensualTrazabilidad[]
  consenso: ConsensoLimites
  actualizando: boolean
  titulo: string
}

type NodoMensual = { x: number; y: number; punto: PuntoMensualTrazabilidad }

// Mismo dominio Y que el modo crudo (promedios mensuales + consenso de
// extremo) — los promedios ya son valores limpios, sin riesgo de outlier que
// deforme la escala.
function calcularGeometriaMensual(puntos: PuntoMensualTrazabilidad[], consenso: ConsensoLimites) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const fechasMs = puntos.map((p) => msDesdeMes(p.mes))
  const { escalaX, xTicks, mostrarAnio } = calcularEscalaX(fechasMs, anchoUtil)

  const valores = puntos.map((p) => p.promedioValorLimpio)
  const [minValor, maxValor] = minMax([...valores, consenso.extremoConsenso.inferior, consenso.extremoConsenso.superior])
  const colchon = (maxValor - minValor || Math.abs(maxValor) || 1) * 0.12
  const min = minValor - colchon
  const max = maxValor + colchon
  const rango = max - min || 1
  const escalaY = (v: number) => MARGEN.top + altoUtil - ((v - min) / rango) * altoUtil

  const nodos: NodoMensual[] = puntos.map((p, i) => ({
    x: escalaX(fechasMs[i]),
    y: escalaY(p.promedioValorLimpio),
    punto: p,
  }))

  const path = pathSuave(nodos)

  const yTicks = Array.from({ length: N_TICKS_Y + 1 }, (_, i) => {
    const valor = min + (rango * i) / N_TICKS_Y
    return { valor, y: escalaY(valor) }
  })

  return { nodos, path, yTicks, xTicks, mostrarAnio, escalaY }
}

function GraficoSvgMensual({ puntos, consenso, actualizando, titulo }: PropsMensual) {
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { nodos, path, yTicks, xTicks, escalaY } = useMemo(
    () => calcularGeometriaMensual(puntos, consenso),
    [puntos, consenso],
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
    <div
      className="relative w-full transition-opacity duration-300"
      style={{ height: ALTO, opacity: actualizando ? 0.55 : 1 }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Trazabilidad limpia (vista mensual agregada) — ${titulo}`}
      >
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
            {formatearMesDesdeMs(t.ms)}
          </text>
        ))}

        {/* los 2 "rieles" de consenso — idénticos al modo crudo, no cambian
            con la agregación */}
        <ConsensoBandas
          consenso={consenso}
          escalaY={escalaY}
          x={MARGEN.left}
          ancho={ANCHO - MARGEN.left - MARGEN.right}
        />

        {/* línea suave: pocos puntos espaciados por mes, una polilínea recta
            se vería angulosa */}
        {path && (
          <path d={path} fill="none" stroke={COLOR_NORMAL} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* marcadores minimalistas — uno por mes, ya de por sí poco densos */}
        {nodos.map((n, i) => (
          <circle
            key={`mensual-${i}`}
            cx={n.x}
            cy={n.y}
            r={hover === i ? 5.5 : 3.5}
            fill={COLOR_NORMAL}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

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

      {nodoHover && <TooltipMensual nodo={nodoHover} />}

      {nodos.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/70 px-4 py-2 font-body text-sm text-concreto-oscuro">
            Sin puntos dentro del consenso en el periodo seleccionado.
          </p>
        </div>
      )}
    </div>
  )
}

// Mismo patrón visual que TooltipPunto de GraficoTasaMensual (Tasa de
// Desgaste): título del mes en negrita, valor destacado en verde-oscuro,
// desglose normal/recortado con los mismos tonos que el resto de esta
// pantalla usa para esos 2 estados.
function TooltipMensual({ nodo }: { nodo: NodoMensual }) {
  const { punto } = nodo
  const izquierda = Math.min(92, Math.max(8, (nodo.x / ANCHO) * 100))

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
        <p className="font-body text-xs font-semibold capitalize text-concreto-oscuro">
          {formatearMesDesdeMs(msDesdeMes(punto.mes))}
        </p>
        <p className="mt-0.5 font-data text-sm text-verde-oscuro">{punto.promedioValorLimpio.toFixed(6)} mm/mes</p>
        <p className="mt-1 font-body text-[0.6875rem] text-concreto">
          <span className="text-verde-oscuro">{punto.conteoNormal}</span> normal(es) ·{' '}
          <span className="text-[color:var(--color-estado-seguimiento)]">{punto.conteoRecortado}</span> recortado(s)
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leyenda — común a ambos modos.
// ---------------------------------------------------------------------------

function LeyendaLinea({ color, etiqueta }: { color: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5 font-body text-[0.6875rem] text-concreto-oscuro">
      <svg width={20} height={8} aria-hidden>
        <line x1={0} y1={4} x2={20} y2={4} stroke={color} strokeWidth={2} />
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
