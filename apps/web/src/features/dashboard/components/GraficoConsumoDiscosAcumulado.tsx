import { Info, TrendingUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { PuntoCambiosRealesMes, PuntoRetirosMes } from '../../inventory/types'
import type { PronosticoMes } from '../../projection/types'
import { BotonDescargarGrafico } from './BotonDescargarGrafico'
import {
  ALTO_CONSUMO,
  ANCHO_CONSUMO,
  MARGEN_CONSUMO as MARGEN,
  SERIES_CONSUMO,
  acumularConsumo,
  calcularGeometriaConsumo,
  combinarConsumo,
  formatearMesConsumo,
  pctXConsumo as pctX,
  pctYConsumo as pctY,
  type PuntoConsumo,
} from '../lib/consumoDiscos'

// Transformación pura sobre los datos de GraficoConsumoDiscos.tsx (mismas 3
// series, mismas fuentes, misma geometría — ver
// apps/web/src/features/dashboard/lib/consumoDiscos.ts) — cero llamadas
// nuevas a backend. Ejemplo del usuario: lo de Marzo es "lo de Marzo + lo de
// Enero" — suma corrida mes a mes de cada serie por separado (acumularConsumo).

type Props = {
  retirados?: PuntoRetirosMes[]
  reales?: PuntoCambiosRealesMes[]
  proyeccion?: PronosticoMes[]
  cargando: boolean
}

export function GraficoConsumoDiscosAcumulado({ retirados, reales, proyeccion, cargando }: Props) {
  const [activo, setActivo] = useState<number | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const datos = useMemo(
    () => acumularConsumo(combinarConsumo(retirados ?? [], reales ?? [], proyeccion ?? [])),
    [retirados, reales, proyeccion],
  )
  const { series, ticks, xs } = useMemo(() => calcularGeometriaConsumo(datos), [datos])

  return (
    <GlassSurface fuerte className="rounded-glass p-5">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={16} className="text-concreto-oscuro" aria-hidden />
          <h3 className="font-display text-base font-semibold text-concreto-oscuro">Consumo de discos acumulado</h3>
          <WarningTooltip texto="Igual que Consumo de discos, pero cada mes suma lo del mes anterior (acumulado desde enero).">
            <Info size={14} className="text-concreto" aria-label="Más información" />
          </WarningTooltip>
        </div>
        <BotonDescargarGrafico objetivoRef={contenedorRef} nombreArchivo={`consumo-discos-acumulado-${new Date().getFullYear()}.png`} />
      </div>
      <p className="mb-3 font-body text-xs text-concreto">Enero a diciembre, {new Date().getFullYear()} · acumulado</p>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 font-body text-xs text-concreto">
        {SERIES_CONSUMO.map((serie) => (
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
        <div ref={contenedorRef} className="h-[300px] w-full overflow-x-auto bg-white">
          <div className="relative h-full min-w-[46rem]">
            <svg viewBox={`0 0 ${ANCHO_CONSUMO} ${ALTO_CONSUMO}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Consumo de discos acumulado">
              {ticks.map((t) => (
                <line key={t.valor} x1={MARGEN.left} x2={ANCHO_CONSUMO - MARGEN.right} y1={t.y} y2={t.y} stroke="rgba(140,137,127,0.18)" />
              ))}

              {series.map((serie) => (
                <path key={serie.clave} d={serie.path} fill="none" stroke={serie.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}

              {series.map((serie) =>
                serie.nodos.map((n, i) => (
                  <circle key={`${serie.clave}-${i}`} cx={n.x} cy={n.y} r={activo === i ? 5 : 3} fill={serie.color} stroke="#fff" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                )),
              )}

              {datos.map((d, i) => (
                <rect
                  key={`hover-${d.mes}`}
                  x={xs[i] - ANCHO_CONSUMO / Math.max(datos.length, 1) / 2}
                  y={MARGEN.top}
                  width={ANCHO_CONSUMO / Math.max(datos.length, 1)}
                  height={ALTO_CONSUMO - MARGEN.top - MARGEN.bottom}
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
                  style={{ left: `${pctX(xs[i])}%`, top: `${pctY(ALTO_CONSUMO - MARGEN.bottom + 18)}%`, transform: 'translate(-50%, -50%)', color: 'var(--color-gris-concreto)' }}
                >
                  {formatearMesConsumo(d.mes)}
                </span>
              ))}

              {/* Etiquetas de valor SIEMPRE visibles (no solo n.valor > 0) —
                  a diferencia del gráfico no-acumulado: acá todo mes desde
                  febrero en adelante ya arrastra un acumulado > 0, y el
                  mockup de referencia (EVA/assets/Gráfico.jpeg) muestra la
                  etiqueta en cada punto de forma permanente. */}
              {series.map((serie) =>
                serie.nodos.map((n, i) => (
                  <span
                    key={`etiqueta-${serie.clave}-${i}`}
                    className="absolute whitespace-nowrap font-data text-[10px] font-semibold"
                    style={{ left: `${pctX(n.x)}%`, top: `${pctY(n.y - 12)}%`, transform: 'translate(-50%, -50%)', color: serie.color }}
                  >
                    {n.valor}
                  </span>
                )),
              )}
            </div>

            {activo !== null && datos[activo] && <TooltipMesAcumulado punto={datos[activo]} x={xs[activo]} />}
          </div>
        </div>
      )}
    </GlassSurface>
  )
}

function TooltipMesAcumulado({ punto, x }: { punto: PuntoConsumo; x: number }) {
  const izquierda = Math.min(88, Math.max(12, pctX(x)))
  return (
    <div className="pointer-events-none absolute z-10 top-2" style={{ left: `${izquierda}%`, transform: 'translateX(-50%)' }}>
      <div className="glass-surface glass-surface--strong min-w-[13rem] rounded-2xl px-3 py-2.5">
        <p className="font-body text-xs font-semibold capitalize text-concreto-oscuro">{formatearMesConsumo(punto.mes)}</p>
        <dl className="mt-1 space-y-0.5">
          {SERIES_CONSUMO.map((serie) => (
            <div key={serie.clave} className="flex items-center justify-between gap-3 font-data text-[0.6875rem]">
              <dt className="flex items-center gap-1.5 text-concreto">
                <span className="h-2 w-2 rounded-sm" style={{ background: serie.color }} />
                {serie.etiqueta}
              </dt>
              <dd className="font-semibold text-concreto-oscuro">{punto[serie.clave]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
