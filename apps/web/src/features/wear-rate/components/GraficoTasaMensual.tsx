import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import type { PuntoChartWearRate } from '../types'

// Gráfico de línea propio, sin librería externa (no hay ninguna instalada en
// el proyecto): SVG con viewBox fijo + preserveAspectRatio="none" para que se
// estire al ancho del contenedor sin deformar la escala vertical (la altura
// del <svg> en CSS coincide 1:1 con ALTO, así el tooltip puede posicionarse
// con simple aritmética de porcentaje/px, sin medir el DOM).
const ANCHO = 760
const ALTO = 280
const MARGEN = { top: 24, right: 24, bottom: 40, left: 64 }
const N_TICKS_Y = 4

type NodoChart = { x: number; y: number | null; punto: PuntoChartWearRate }

function formatearMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number)
  if (!anio || !mesNum) return mes
  const fecha = new Date(anio, mesNum - 1, 1)
  return fecha.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
}

function calcularGeometria(puntos: PuntoChartWearRate[]) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const valores = puntos
    .map((p) => p.tasaMensualPromedio)
    .filter((v): v is number => v !== null)
  const min = valores.length ? Math.min(0, ...valores) : 0
  const max = valores.length ? Math.max(...valores) : 1
  const rango = max - min || 1

  const escalaX = (i: number) =>
    puntos.length > 1 ? MARGEN.left + (i / (puntos.length - 1)) * anchoUtil : MARGEN.left + anchoUtil / 2
  const escalaY = (v: number) => MARGEN.top + altoUtil - ((v - min) / rango) * altoUtil

  const nodos: NodoChart[] = puntos.map((p, i) => ({
    x: escalaX(i),
    y: p.tasaMensualPromedio !== null ? escalaY(p.tasaMensualPromedio) : null,
    punto: p,
  }))

  const conValor = nodos.filter((n): n is { x: number; y: number; punto: PuntoChartWearRate } => n.y !== null)
  const path = conValor.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')

  const yTicks = Array.from({ length: N_TICKS_Y + 1 }, (_, i) => {
    const valor = min + (rango * i) / N_TICKS_Y
    return { valor, y: escalaY(valor) }
  })

  // Cada cuántos puntos mostrar etiqueta en el eje X, para no amontonar meses.
  const pasoEtiqueta = Math.max(1, Math.ceil(puntos.length / 8))

  return { nodos, path, yTicks, pasoEtiqueta }
}

type Props = {
  puntos: PuntoChartWearRate[]
  cargando: boolean
  titulo: string
}

export function GraficoTasaMensual({ puntos, cargando, titulo }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const { nodos, path, yTicks, pasoEtiqueta } = useMemo(() => calcularGeometria(puntos), [puntos])

  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-5">
      <h3 className="mb-0.5 font-display text-base font-semibold text-concreto-oscuro">
        Tasa mensual de desgaste — promedio por mes
      </h3>
      <p className="mb-3 font-body text-xs text-concreto">{titulo} · mm/mes</p>

      {cargando ? (
        <div className="flex h-[280px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Cargando gráfico…</p>
        </div>
      ) : puntos.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Sin datos suficientes para graficar.</p>
        </div>
      ) : (
        <div className="relative h-[280px] w-full">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label={`Tasa mensual de desgaste promedio por mes — ${titulo}`}
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

            {nodos.map(
              (n, i) =>
                i % pasoEtiqueta === 0 && (
                  <text
                    key={`x-${n.punto.mes}`}
                    x={n.x}
                    y={ALTO - MARGEN.bottom + 18}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--color-gris-concreto)"
                    className="font-body"
                  >
                    {formatearMes(n.punto.mes)}
                  </text>
                ),
            )}

            {path && (
              <path
                d={path}
                fill="none"
                stroke="var(--color-verde-institucional)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {nodos.map((n, i) => (
              <g key={n.punto.mes}>
                {/* Área de detección más ancha que el punto visible, para que el
                    hover no requiera apuntar exacto al círculo de 4px. */}
                <rect
                  x={n.x - (ANCHO / Math.max(nodos.length, 1)) / 2}
                  y={MARGEN.top}
                  width={ANCHO / Math.max(nodos.length, 1)}
                  height={ALTO - MARGEN.top - MARGEN.bottom}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                />
                {n.y !== null && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={hover === i ? 5.5 : 3.5}
                    fill="var(--color-verde-institucional)"
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            ))}
          </svg>

          {hover !== null && nodos[hover] && <TooltipPunto nodo={nodos[hover]} />}
        </div>
      )}
    </GlassSurface>
  )
}

function TooltipPunto({ nodo }: { nodo: NodoChart }) {
  const { punto } = nodo
  const izquierda = Math.min(92, Math.max(8, (nodo.x / ANCHO) * 100))
  const arriba = nodo.y ?? MARGEN.top

  return (
    // Wrapper propio SOLO para el posicionamiento: .glass-surface (tokens.css)
    // fija position:relative, que le gana en cascada a la utilidad `absolute`
    // de Tailwind si están en la MISMA clase (misma especificidad, tokens.css
    // se carga después) — separarlos en dos divs evita el conflicto.
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: `${izquierda}%`,
        top: arriba,
        transform: 'translate(-50%, calc(-100% - 12px))',
      }}
    >
      <div className="glass-surface glass-surface--strong min-w-[11rem] rounded-2xl px-3 py-2.5">
        <p className="font-body text-xs font-semibold capitalize text-concreto-oscuro">
          {formatearMes(punto.mes)}
        </p>
        <p className="mt-0.5 font-data text-sm text-verde-oscuro">
          {punto.tasaMensualPromedio !== null
            ? `${punto.tasaMensualPromedio.toFixed(4)} mm/mes`
            : 'Sin pares válidos'}
        </p>
        <p className="mt-1 font-body text-[0.6875rem] text-concreto">
          <span className="text-verde-oscuro">{punto.paresValidos}</span> válido(s) ·{' '}
          <span className="text-[color:var(--color-estado-seguimiento)]">{punto.paresInvalidos}</span> inválido(s)
        </p>
      </div>
    </div>
  )
}
