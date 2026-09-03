import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { PronosticoMes, TipoEventoPronostico } from '../types'
import { datosMensuales, type DatoBarra, type VistaBarras } from '../lib/pronosticoBarras'

const ANIO_INICIAL = 2026
const ANIO_FINAL = 2032
const ANCHO = 900
const ALTO = 320
const MARGEN = { top: 28, right: 28, bottom: 54, left: 56 }
const MOSTRAR_REPERFILADOS = true

type Props = {
  meses: PronosticoMes[]
  cargando: boolean
  vista: VistaBarras
  onCambiarVista: (vista: VistaBarras) => void
  anio: number
  onCambiarAnio: (anio: number) => void
}

function datosAnuales(meses: PronosticoMes[]): DatoBarra[] {
  return Array.from({ length: ANIO_FINAL - ANIO_INICIAL + 1 }, (_, indice) => {
    const anio = String(ANIO_INICIAL + indice)
    const acumulado = meses
      .filter((mes) => mes.mes.startsWith(anio))
      .reduce(
        (total, mes) => ({
          reperfilados: total.reperfilados + mes.reperfilados,
          cambios: total.cambios + mes.cambios,
          criticos: total.criticos + mes.desgloseEstado.critico,
        }),
        { reperfilados: 0, cambios: 0, criticos: 0 },
      )
    return { periodo: anio, etiqueta: anio, ...acumulado }
  })
}

function BotonNavegacion({
  direccion,
  disabled,
  onClick,
}: {
  direccion: 'anterior' | 'siguiente'
  disabled: boolean
  onClick: () => void
}) {
  const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight
  const etiqueta = direccion === 'anterior' ? 'Ver año anterior' : 'Ver año siguiente'
  return (
    <WarningTooltip texto={etiqueta} posicion="abajo">
      <button
        type="button"
        aria-label={etiqueta}
        disabled={disabled}
        onClick={onClick}
        className="glass-surface glass-button-secondary inline-flex h-9 w-9 items-center justify-center text-concreto-oscuro disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icono size={18} aria-hidden />
      </button>
    </WarningTooltip>
  )
}

export function GraficoBarrasPronostico({
  meses,
  cargando,
  vista,
  onCambiarVista,
  anio,
  onCambiarAnio,
}: Props) {
  const datos = vista === 'anio' ? datosAnuales(meses) : datosMensuales(meses, anio)
  const maximo = Math.max(
    1,
    ...datos.map((dato) => dato.cambios),
    ...datos.map((dato) => dato.criticos),
    ...(MOSTRAR_REPERFILADOS ? datos.map((dato) => dato.reperfilados) : []),
  )
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom
  const anchoGrupo = anchoUtil / Math.max(datos.length, 1)
  const cantidadSeries = MOSTRAR_REPERFILADOS ? 3 : 2
  const anchoBarra = Math.max(5, Math.min(20, (anchoGrupo * 0.75) / cantidadSeries))
  const ticks = Array.from({ length: 5 }, (_, indice) => Math.round((maximo * indice) / 4))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Agrupación del gráfico de barras"
          opciones={[
            { valor: 'anio', etiqueta: 'Por año' },
            { valor: 'mes', etiqueta: 'Por mes' },
          ]}
          valor={vista}
          onCambiar={onCambiarVista}
        />
        {vista === 'mes' && (
          <div className="flex items-center gap-2">
            <BotonNavegacion
              direccion="anterior"
              disabled={anio <= ANIO_INICIAL}
              onClick={() => onCambiarAnio(anio - 1)}
            />
            <span className="min-w-14 text-center font-data text-sm text-concreto-oscuro">{anio}</span>
            <BotonNavegacion
              direccion="siguiente"
              disabled={anio >= ANIO_FINAL}
              onClick={() => onCambiarAnio(anio + 1)}
            />
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 font-body text-xs text-concreto">
        {MOSTRAR_REPERFILADOS && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--color-estado-reperfilado)]" />
            Reperfilados
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--color-estado-cambio)]" />
          Cambios
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--color-estado-critico)]" />
          Críticos
        </span>
      </div>

      {cargando ? (
        <div className="flex h-[320px] items-center justify-center">
          <p className="font-body text-sm text-concreto">Cargando gráfico…</p>
        </div>
      ) : (
        <div className="relative h-[320px] w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            className="h-full min-w-[42rem] w-full"
            role="img"
            aria-label="Cambios proyectados"
          >
            {ticks.map((valor) => {
              const y = MARGEN.top + altoUtil - (valor / maximo) * altoUtil
              return (
                <g key={valor}>
                  <line x1={MARGEN.left} x2={ANCHO - MARGEN.right} y1={y} y2={y} stroke="rgba(140,137,127,0.18)" />
                  <text
                    x={MARGEN.left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={10}
                    fill="var(--color-gris-concreto)"
                    className="font-data"
                  >
                    {valor}
                  </text>
                </g>
              )
            })}
            {datos.map((dato, indice) => {
              const centro = MARGEN.left + anchoGrupo * (indice + 0.5)
              const separacion = 2
              const anchoTotalSeries = cantidadSeries * anchoBarra + (cantidadSeries - 1) * separacion
              const xInicial = centro - anchoTotalSeries / 2
              let cursor = xInicial
              const siguienteX = () => {
                const x = cursor
                cursor += anchoBarra + separacion
                return x
              }
              const series: {
                tipo: TipoEventoPronostico | 'CRITICO'
                etiqueta: string
                valor: number
                x: number
                color: string
              }[] = [
                ...(MOSTRAR_REPERFILADOS
                  ? [
                      {
                        tipo: 'REPERFILADO' as const,
                        etiqueta: 'Reperfilados',
                        valor: dato.reperfilados,
                        x: siguienteX(),
                        color: 'var(--color-estado-reperfilado)',
                      },
                    ]
                  : []),
                {
                  tipo: 'CAMBIO',
                  etiqueta: 'Cambios',
                  valor: dato.cambios,
                  x: siguienteX(),
                  color: 'var(--color-estado-cambio)',
                },
                {
                  tipo: 'CRITICO',
                  etiqueta: 'Críticos',
                  valor: dato.criticos,
                  x: siguienteX(),
                  color: 'var(--color-estado-critico)',
                },
              ]
              return (
                <g key={dato.periodo}>
                  <text
                    x={centro}
                    y={ALTO - MARGEN.bottom + 20}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--color-gris-concreto)"
                    className="font-body"
                  >
                    {dato.etiqueta}
                  </text>
                  {series.map((serie) => {
                    const alto = (serie.valor / maximo) * altoUtil
                    const y = MARGEN.top + altoUtil - alto
                    return (
                      <g key={serie.tipo}>
                        <text
                          x={serie.x + anchoBarra / 2}
                          y={Math.max(MARGEN.top - 8, y - 8)}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={600}
                          fill="var(--color-concreto-oscuro)"
                          className="font-data"
                          style={{ pointerEvents: 'none' }}
                        >
                          {serie.valor}
                        </text>
                        <rect
                          x={serie.x}
                          y={y}
                          width={anchoBarra}
                          height={Math.max(1, alto)}
                          rx={2}
                          fill={serie.color}
                          aria-label={`${serie.etiqueta}: ${serie.valor}, ${dato.etiqueta}`}
                        />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
