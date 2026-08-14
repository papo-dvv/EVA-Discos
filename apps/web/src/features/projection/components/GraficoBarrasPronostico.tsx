import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { PronosticoMes, TipoEventoPronostico } from '../types'

const ANIO_INICIAL = 2026
const ANIO_FINAL = 2032
const ANCHO = 900
const ALTO = 320
const MARGEN = { top: 28, right: 28, bottom: 54, left: 56 }

type VistaBarras = 'anio' | 'mes'
type DatoBarra = {
  periodo: string
  etiqueta: string
  reperfilados: number
  cambios: number
}

type Props = {
  meses: PronosticoMes[]
  cargando: boolean
  vista: VistaBarras
  onCambiarVista: (vista: VistaBarras) => void
  anio: number
  onCambiarAnio: (anio: number) => void
  onSeleccionar: (periodo: string, tipo: TipoEventoPronostico) => void
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
        }),
        { reperfilados: 0, cambios: 0 },
      )
    return { periodo: anio, etiqueta: anio, ...acumulado }
  })
}

function datosMensuales(meses: PronosticoMes[], anio: number): DatoBarra[] {
  return meses
    .filter((mes) => mes.mes.startsWith(String(anio)))
    .map((mes) => ({
      periodo: mes.mes,
      etiqueta: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(
        new Date(anio, Number(mes.mes.slice(5, 7)) - 1, 1),
      ),
      reperfilados: mes.reperfilados,
      cambios: mes.cambios,
    }))
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
  onSeleccionar,
}: Props) {
  const datos = vista === 'anio' ? datosAnuales(meses) : datosMensuales(meses, anio)
  const maximo = Math.max(1, ...datos.flatMap((dato) => [dato.reperfilados, dato.cambios]))
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom
  const anchoGrupo = anchoUtil / Math.max(datos.length, 1)
  const anchoBarra = Math.max(6, Math.min(26, anchoGrupo * 0.3))
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
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--color-estado-reperfilado)]" />
          Reperfilados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--color-estado-cambio)]" />
          Cambios
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
            aria-label="Reperfilados y cambios proyectados"
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
              const series: {
                tipo: TipoEventoPronostico
                valor: number
                x: number
                color: string
              }[] = [
                {
                  tipo: 'REPERFILADO',
                  valor: dato.reperfilados,
                  x: centro - anchoBarra - 2,
                  color: 'var(--color-estado-reperfilado)',
                },
                {
                  tipo: 'CAMBIO',
                  valor: dato.cambios,
                  x: centro + 2,
                  color: 'var(--color-estado-cambio)',
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
                          role="button"
                          tabIndex={0}
                          aria-label={`${serie.tipo === 'CAMBIO' ? 'Cambios' : 'Reperfilados'}: ${serie.valor}, ${dato.etiqueta}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSeleccionar(dato.periodo, serie.tipo)}
                          onKeyDown={(evento) => {
                            if (evento.key === 'Enter' || evento.key === ' ') {
                              evento.preventDefault()
                              onSeleccionar(dato.periodo, serie.tipo)
                            }
                          }}
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
