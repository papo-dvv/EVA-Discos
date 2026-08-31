import { Info, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { TIPOS_COCHE_ALSTOM, type PuntoTasaPorTipoCoche, type TipoCocheAlstom } from '../../traceability/types'
import type { PuntoChartWearRate } from '../../wear-rate/types'

// Mismo criterio "SVG propio, sin librería" que GraficoTasaMensual.tsx (no
// hay ninguna instalada en el proyecto) — acá con 6 series en vez de 1, una
// por tipo de coche Alstom (MA1/MB1/MB3/REM/MB2/MA2, ORDEN_COCHE_FLOTA).
// ALTO +43% (280->400) y escala Y con padding sobre el rango REAL de los
// datos (no forzada a arrancar en 0): con los 6 valores mensuales
// concentrados en una banda angosta, un eje 0-max los aplastaba contra el
// piso del gráfico — acotar la escala a [min-padding, max+padding] separa
// visualmente las líneas sin distorsionar su lectura relativa.
//
// TODO EL TEXTO vive fuera del <svg>, en un overlay HTML posicionado por
// porcentaje (pctX/pctY) — con preserveAspectRatio="none" (necesario para
// que el gráfico llene el ancho completo de la tarjeta, que en este
// dashboard es MUCHO más ancha que el viewBox), el <svg> escala X e Y de
// forma independiente. Eso es inofensivo para líneas/puntos (son solo
// coordenadas), pero un <text> DENTRO del svg se deforma con esa misma
// distorsión no uniforme — letras achatadas y estiradas ("aplastadas"). El
// texto en HTML normal, en cambio, nunca se deforma así: solo hereda la
// POSICIÓN vía porcentaje, nunca el estiramiento de los ejes.
const ANCHO = 760
const ALTO = 400
const MARGEN = { top: 24, right: 52, bottom: 40, left: 56 }
const N_TICKS_Y = 5
const PADDING_RATIO = 0.12

const pctX = (x: number) => (x / ANCHO) * 100
const pctY = (y: number) => (y / ALTO) * 100

const COLOR_COCHE: Record<TipoCocheAlstom, string> = {
  MA1: '#059669',
  MB1: '#2563eb',
  MB3: '#d97706',
  REM: '#7c3aed',
  MB2: '#dc2626',
  MA2: '#0891b2',
}

function formatearMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number)
  if (!anio || !mesNum) return mes
  return new Date(anio, mesNum - 1, 1).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
}

// El backend siempre devuelve los 12 meses del año (enero a diciembre, ver
// TraceabilityService.obtenerSeriesPorTipoCoche) para que el gráfico arranque
// en enero cuando SÍ hay datos ahí — pero si el primer par válido del año
// recién aparece en, por ejemplo, marzo, mostrar enero/febrero vacíos deja
// un hueco muerto al inicio que se lee como un gráfico roto/cortado. Se
// recortan solo los meses de ARRANQUE sin ningún dato (de cualquier tipo de
// coche); los meses futuros sin dato todavía (después del mes en curso) se
// conservan tal cual, para que la línea de "Hoy" siga teniendo contexto.
// Une, por mes, el promedio fleet-wide que ya trae /wear-rate/chart (la misma
// fuente de la KPI "Tasa promedio por mes") al set de series por coche — sin
// pedirle nada nuevo al backend.
type PuntoConPromedio = PuntoTasaPorTipoCoche & { promedio: number | null }

function mezclarPromedio(puntos: PuntoTasaPorTipoCoche[], promedioFlota: PuntoChartWearRate[]): PuntoConPromedio[] {
  const mapa = new Map(promedioFlota.map((p) => [p.mes, p.tasaMensualPromedio]))
  return puntos.map((p) => ({ ...p, promedio: mapa.get(p.mes) ?? null }))
}

function recortarInicioVacio(puntos: PuntoConPromedio[]): PuntoConPromedio[] {
  const primerIndiceConDato = puntos.findIndex((p) => TIPOS_COCHE_ALSTOM.some((t) => p[t] !== null) || p.promedio !== null)
  return primerIndiceConDato <= 0 ? puntos : puntos.slice(primerIndiceConDato)
}

// mesActualIdx: índice del mes calendario EN CURSO dentro de `puntos` (el
// backend siempre lo incluye como null — todavía no cierra, ver comentario de
// arriba). Cada serie que termina justo un mes antes agrega un tramo extra
// PUNTEADO (mismo valor que su último dato real, en línea recta) desde ese
// último punto hasta el mes en curso — así la línea "llega hasta hoy" en vez
// de cortarse en seco en julio, sin inventar un dato real para agosto (pedido
// explícito: truncar en julio por falta de datos, pero visualizarlo partido
// por guiones en vez de con un hueco muerto al final).
function calcularGeometria(puntos: PuntoConPromedio[], mesActualIdx: number) {
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const valores = puntos.flatMap((p) =>
    [...TIPOS_COCHE_ALSTOM.map((t) => p[t]), p.promedio].filter((v): v is number => v !== null),
  )
  const minDato = valores.length ? Math.min(...valores) : 0
  const maxDato = valores.length ? Math.max(...valores) : 1
  const rangoDatos = maxDato - minDato || maxDato || 1
  const min = Math.max(0, minDato - rangoDatos * PADDING_RATIO)
  const max = maxDato + rangoDatos * PADDING_RATIO
  const rango = max - min || 1

  const escalaX = (i: number) =>
    puntos.length > 1 ? MARGEN.left + (i / (puntos.length - 1)) * anchoUtil : MARGEN.left + anchoUtil / 2
  const escalaY = (v: number) => MARGEN.top + altoUtil - ((v - min) / rango) * altoUtil

  const series = TIPOS_COCHE_ALSTOM.map((tipo) => {
    const nodos = puntos.map((p, i) => ({
      x: escalaX(i),
      y: p[tipo] !== null ? escalaY(p[tipo] as number) : null,
      valor: p[tipo],
    }))
    const conValor = nodos.filter((n): n is { x: number; y: number; valor: number } => n.y !== null)
    const path = conValor.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' ')
    const ultimo = conValor.at(-1) ?? null
    const ultimoIdx = ultimo ? nodos.findIndex((n) => n === ultimo) : -1
    const colaPunteada =
      ultimo && mesActualIdx > ultimoIdx
        ? `M ${ultimo.x.toFixed(1)} ${ultimo.y.toFixed(1)} L ${escalaX(mesActualIdx).toFixed(1)} ${ultimo.y.toFixed(1)}`
        : null
    return { tipo, nodos, path, ultimo, colaPunteada }
  })

  const nodosPromedio = puntos.map((p, i) => ({
    x: escalaX(i),
    y: p.promedio !== null ? escalaY(p.promedio) : null,
    valor: p.promedio,
  }))
  const conValorPromedio = nodosPromedio.filter((n): n is { x: number; y: number; valor: number } => n.y !== null)
  const seriePromedio = {
    nodos: nodosPromedio,
    path: conValorPromedio.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`).join(' '),
    ultimo: conValorPromedio.at(-1) ?? null,
  }

  const yTicks = Array.from({ length: N_TICKS_Y + 1 }, (_, i) => {
    const valor = min + (rango * i) / N_TICKS_Y
    return { valor, y: escalaY(valor) }
  })

  const pasoEtiqueta = Math.max(1, Math.ceil(puntos.length / 8))
  const xs = puntos.map((_, i) => escalaX(i))

  return { series, seriePromedio, yTicks, pasoEtiqueta, xs }
}

type Props = {
  puntos: PuntoTasaPorTipoCoche[]
  promedioFlota: PuntoChartWearRate[]
  cargando: boolean
}

export function GraficoTasaPorCoche({ puntos: puntosCompletos, promedioFlota, cargando }: Props) {
  const [activo, setActivo] = useState<number | null>(null)
  const [ocultas, setOcultas] = useState<Set<TipoCocheAlstom>>(() => new Set())
  const [ocultoPromedio, setOcultoPromedio] = useState(false)
  const puntos = useMemo(
    () => recortarInicioVacio(mezclarPromedio(puntosCompletos, promedioFlota)),
    [puntosCompletos, promedioFlota],
  )
  // "Hoy" apunta al mes calendario EN CURSO (siempre presente en `puntos`,
  // aunque venga null: el backend nunca lo cierra — ver comentario de
  // calcularGeometria). Es también hasta dónde llega el tramo punteado de
  // cada serie.
  const mesActual = useMemo(() => {
    const fecha = new Date()
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const indiceHoy = puntos.findIndex((p) => p.mes === mesActual)
  const { series, seriePromedio, yTicks, pasoEtiqueta, xs } = useMemo(
    () => calcularGeometria(puntos, indiceHoy),
    [puntos, indiceHoy],
  )

  function alternar(tipo: TipoCocheAlstom) {
    setOcultas((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(tipo)) siguiente.delete(tipo)
      else siguiente.add(tipo)
      return siguiente
    })
  }

  return (
    <GlassSurface fuerte className="rounded-glass p-5">
      <div className="mb-0.5 flex items-center gap-1.5">
        <TrendingDown size={16} className="text-concreto-oscuro" aria-hidden />
        <h3 className="font-display text-base font-semibold text-concreto-oscuro">
          Tasa de desgaste mensual por tipo de coche
        </h3>
        <WarningTooltip texto="Promedio mensual de mm de desgaste por par de mediciones válido, desglosado por tipo de coche (dato limpio de Trazabilidad: consenso Gauss∩Percentiles∩Tukey sobre el histórico completo de cada tipo). Solo el año en curso. El tramo punteado hasta hoy repite el último valor real — el mes en curso todavía no tiene datos cerrados. Clic en la leyenda oculta/muestra una línea.">
          <Info size={14} className="text-concreto" aria-label="Más información" />
        </WarningTooltip>
      </div>
      <p className="mb-3 font-body text-xs text-concreto">mm/mes · promedio fleet-wide de pares válidos, {new Date().getFullYear()}</p>

      <div className="mb-3 flex flex-wrap gap-x-1 gap-y-1.5 font-body text-xs">
        {TIPOS_COCHE_ALSTOM.map((tipo) => {
          const oculto = ocultas.has(tipo)
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => alternar(tipo)}
              aria-pressed={!oculto}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${oculto ? 'text-concreto opacity-45' : 'text-concreto-oscuro hover:bg-black/[0.03]'}`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: oculto ? 'var(--color-gris-concreto)' : COLOR_COCHE[tipo] }} />
              {tipo}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setOcultoPromedio((v) => !v)}
          aria-pressed={!ocultoPromedio}
          className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${ocultoPromedio ? 'text-concreto opacity-45' : 'text-concreto-oscuro hover:bg-black/[0.03]'}`}
        >
          <span
            className="h-0 w-3 border-t-2 border-dashed"
            style={{ borderColor: ocultoPromedio ? 'var(--color-gris-concreto)' : '#40403c' }}
          />
          Promedio
        </button>
      </div>

      {cargando ? (
        <div className="flex h-[400px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Cargando gráfico…</p>
        </div>
      ) : puntos.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Sin datos suficientes para graficar.</p>
        </div>
      ) : (
        <div className="relative h-[400px] w-full">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            role="img"
            aria-label="Tasa de desgaste mensual por tipo de coche"
          >
            {yTicks.map((t, i) => (
              <line
                key={t.valor}
                x1={MARGEN.left}
                x2={ANCHO - MARGEN.right}
                y1={t.y}
                y2={t.y}
                stroke={i === 0 ? 'rgba(140,137,127,0.4)' : 'rgba(140,137,127,0.16)'}
                strokeWidth={i === 0 ? 1.25 : 1}
              />
            ))}

            {indiceHoy >= 0 && (
              <line x1={xs[indiceHoy]} x2={xs[indiceHoy]} y1={MARGEN.top} y2={ALTO - MARGEN.bottom} stroke="rgba(140,137,127,0.4)" strokeDasharray="4 3" />
            )}

            {activo !== null && (
              <line x1={xs[activo]} x2={xs[activo]} y1={MARGEN.top} y2={ALTO - MARGEN.bottom} stroke="rgba(140,137,127,0.3)" strokeDasharray="3 3" />
            )}

            {series
              .filter((serie) => !ocultas.has(serie.tipo))
              .map((serie) => (
                <path
                  key={serie.tipo}
                  d={serie.path}
                  fill="none"
                  stroke={COLOR_COCHE[serie.tipo]}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

            {/* Tramo punteado: del último mes con dato real (julio) hasta
                "Hoy" — mismo valor, en línea recta, sin marcador ni etiqueta
                propia (no es un dato real, solo visualiza que la serie sigue
                "viva" mientras agosto todavía no cierra). */}
            {series
              .filter((serie) => !ocultas.has(serie.tipo) && serie.colaPunteada !== null)
              .map((serie) => (
                <path
                  key={`cola-${serie.tipo}`}
                  d={serie.colaPunteada!}
                  fill="none"
                  stroke={COLOR_COCHE[serie.tipo]}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  opacity={0.55}
                />
              ))}

            {!ocultoPromedio && (
              <path
                d={seriePromedio.path}
                fill="none"
                stroke="#40403c"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {series
              .filter((serie) => !ocultas.has(serie.tipo))
              .map((serie) =>
                serie.nodos.map(
                  (n, i) =>
                    n.y !== null && (
                      <circle
                        key={`${serie.tipo}-${i}`}
                        cx={n.x}
                        cy={n.y}
                        r={activo === i ? 5.5 : 3}
                        fill={COLOR_COCHE[serie.tipo]}
                        stroke="#fff"
                        strokeWidth={1.5}
                        style={{ pointerEvents: 'none' }}
                      />
                    ),
                ),
              )}

            {puntos.map((p, i) => (
              <rect
                key={`hover-${p.mes}`}
                x={xs[i] - ANCHO / Math.max(puntos.length, 1) / 2}
                y={MARGEN.top}
                width={ANCHO / Math.max(puntos.length, 1)}
                height={ALTO - MARGEN.top - MARGEN.bottom}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo((h) => (h === i ? null : h))}
              />
            ))}
          </svg>

          {/* Overlay de texto — ver comentario grande arriba del archivo:
              nunca se deforma, aunque el <svg> de al lado escale X/Y distinto. */}
          <div className="pointer-events-none absolute inset-0">
            {yTicks.map((t) => (
              <span
                key={t.valor}
                className="absolute font-data text-[10px]"
                style={{ left: `${pctX(MARGEN.left - 8)}%`, top: `${pctY(t.y)}%`, transform: 'translate(-100%, -50%)', color: 'var(--color-gris-concreto)' }}
              >
                {t.valor.toFixed(4)}
              </span>
            ))}

            {puntos.map(
              (p, i) =>
                i % pasoEtiqueta === 0 && (
                  <span
                    key={`x-${p.mes}`}
                    className="absolute whitespace-nowrap font-body text-[10px]"
                    style={{ left: `${pctX(xs[i])}%`, top: `${pctY(ALTO - MARGEN.bottom + 18)}%`, transform: 'translate(-50%, -50%)', color: 'var(--color-gris-concreto)' }}
                  >
                    {formatearMes(p.mes)}
                  </span>
                ),
            )}

            {indiceHoy >= 0 && (
              <span
                className="absolute font-body text-[9px] font-semibold uppercase tracking-wide"
                style={{ left: `${pctX(xs[indiceHoy])}%`, top: `${pctY(MARGEN.top - 8)}%`, transform: 'translate(-50%, -50%)', color: 'var(--color-gris-concreto)' }}
              >
                Hoy
              </span>
            )}

            {/* Etiqueta de valor al final de cada línea visible — último mes
                con dato de esa serie, no necesariamente el último punto del
                eje (un tipo de coche puede no tener par válido en el mes en
                curso todavía). */}
            {series
              .filter((serie) => !ocultas.has(serie.tipo) && serie.ultimo !== null)
              .map((serie) => (
                <span
                  key={`etiqueta-${serie.tipo}`}
                  className="absolute whitespace-nowrap font-data text-[10px] font-bold"
                  style={{
                    left: `${pctX((serie.ultimo?.x ?? 0) + 6)}%`,
                    top: `${pctY(serie.ultimo?.y ?? 0)}%`,
                    transform: 'translate(0, -50%)',
                    color: COLOR_COCHE[serie.tipo],
                  }}
                >
                  {serie.ultimo?.valor?.toFixed(3)}
                </span>
              ))}

            {!ocultoPromedio && seriePromedio.ultimo !== null && (
              <span
                className="absolute whitespace-nowrap font-data text-[10px] font-bold"
                style={{
                  left: `${pctX(seriePromedio.ultimo.x + 6)}%`,
                  top: `${pctY(seriePromedio.ultimo.y)}%`,
                  transform: 'translate(0, -50%)',
                  color: '#40403c',
                }}
              >
                {seriePromedio.ultimo.valor.toFixed(3)}
              </span>
            )}
          </div>

          {activo !== null && puntos[activo] && (
            <TooltipMes punto={puntos[activo]} x={xs[activo]} ocultas={ocultas} ocultoPromedio={ocultoPromedio} />
          )}
        </div>
      )}
    </GlassSurface>
  )
}

function TooltipMes({
  punto,
  x,
  ocultas,
  ocultoPromedio,
}: {
  punto: PuntoConPromedio
  x: number
  ocultas: Set<TipoCocheAlstom>
  ocultoPromedio: boolean
}) {
  const izquierda = Math.min(88, Math.max(12, pctX(x)))
  return (
    <div
      className="pointer-events-none absolute z-10 top-2"
      style={{ left: `${izquierda}%`, transform: 'translateX(-50%)' }}
    >
      <div className="glass-surface glass-surface--strong min-w-[10rem] rounded-2xl px-3 py-2.5">
        <p className="font-body text-xs font-semibold capitalize text-concreto-oscuro">{formatearMes(punto.mes)}</p>
        <dl className="mt-1 space-y-0.5">
          {TIPOS_COCHE_ALSTOM.filter((tipo) => !ocultas.has(tipo)).map((tipo) => (
            <div key={tipo} className="flex items-center justify-between gap-3 font-data text-[0.6875rem]">
              <dt className="flex items-center gap-1.5 text-concreto">
                <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_COCHE[tipo] }} />
                {tipo}
              </dt>
              <dd className="font-semibold text-concreto-oscuro">
                {punto[tipo] !== null ? punto[tipo]!.toFixed(4) : '—'}
              </dd>
            </div>
          ))}
          {!ocultoPromedio && (
            <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-0.5 font-data text-[0.6875rem]">
              <dt className="flex items-center gap-1.5 text-concreto">
                <span className="h-0 w-2 border-t-2 border-dashed" style={{ borderColor: '#40403c' }} />
                Promedio
              </dt>
              <dd className="font-semibold text-concreto-oscuro">
                {punto.promedio !== null ? punto.promedio.toFixed(4) : '—'}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
