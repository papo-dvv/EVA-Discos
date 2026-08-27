import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { useFleetHistorico } from '../queries'
import type { FleetDiscoDetalle, FleetHistoricoPunto } from '../types'

type Props = {
  disco: FleetDiscoDetalle
  onCerrar: () => void
}

function formato(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : valor.toFixed(2)
}

export function ModalHistoricoDisco({ disco, onCerrar }: Props) {
  const historico = useFleetHistorico(disco.codigoDisco, disco.lado)

  return (
    <GlassModal
      titulo={`Disco ${disco.codigoDisco ?? 'sin código'} · ${disco.lado}`}
      onCerrar={onCerrar}
      ancho={820}
      altoMaximo="min(760px, calc(100dvh - 1.5rem))"
    >
      <ScrollArea className="min-h-0 flex-1" viewportClassName="min-h-0 flex-1">
        {historico.isLoading && <p className="py-8 text-center font-body text-sm text-concreto">Cargando histórico...</p>}
        {historico.isError && (
          <p role="alert" className="py-8 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el histórico del disco.
          </p>
        )}
        {historico.data && (
          <div className="space-y-4 pr-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <DatoActual etiqueta="Rd actual" valor={historico.data.actual.rd} />
              <DatoActual etiqueta="H actual" valor={historico.data.actual.h} />
              <DatoActual etiqueta="T actual" valor={historico.data.actual.t} />
            </div>

            {historico.data.historico.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white/35 px-4 py-8 text-center font-body text-sm text-concreto">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <GraficoHistorico puntos={historico.data.historico} />
                <TablaHistorico puntos={historico.data.historico} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </GlassModal>
  )
}

function DatoActual({ etiqueta, valor }: { etiqueta: string; valor: number | null | undefined }) {
  return (
    <div className="rounded-glass border border-concreto/15 bg-white/40 px-4 py-3">
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">{etiqueta}</p>
      <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">{formato(valor)}</p>
    </div>
  )
}

function GraficoHistorico({ puntos }: { puntos: FleetHistoricoPunto[] }) {
  const series = [
    { key: 'rd' as const, label: 'Rd', color: 'var(--color-verde)' },
    { key: 'h' as const, label: 'H', color: 'var(--color-estado-cambio)' },
    { key: 't' as const, label: 'T', color: 'var(--color-estado-reperfilado)' },
  ]
  const valores = puntos.flatMap((p) => series.map((s) => p[s.key]).filter((v): v is number => typeof v === 'number'))
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  const ancho = 720
  const alto = 260
  const padX = 46
  const padY = 28
  const x = (idx: number) => padX + (idx * (ancho - padX * 2)) / Math.max(1, puntos.length - 1)
  const y = (valor: number) => alto - padY - ((valor - min) * (alto - padY * 2)) / rango
  const pathSerie = (key: 'rd' | 'h' | 't') =>
    puntos
      .map((p, idx) => {
        const valor = p[key]
        if (valor === null || valor === undefined) return ''
        return `${idx === 0 ? 'M' : 'L'} ${x(idx)} ${y(valor)}`
      })
      .filter(Boolean)
      .join(' ')

  return (
    <div className="rounded-glass border border-concreto/15 bg-white/35 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {series.map((serie) => (
          <span key={serie.key} className="inline-flex items-center gap-2 font-body text-xs font-semibold text-concreto-oscuro">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: serie.color }} />
            {serie.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-auto w-full" role="img" aria-label="Histórico Rd H T">
        <line x1={padX} y1={alto - padY} x2={ancho - padX} y2={alto - padY} stroke="rgba(100,116,139,0.25)" />
        <line x1={padX} y1={padY} x2={padX} y2={alto - padY} stroke="rgba(100,116,139,0.25)" />
        {[0, 0.5, 1].map((t) => {
          const valor = min + rango * t
          const yy = y(valor)
          return (
            <g key={t}>
              <line x1={padX} y1={yy} x2={ancho - padX} y2={yy} stroke="rgba(100,116,139,0.11)" />
              <text x={padX - 10} y={yy + 4} textAnchor="end" className="fill-concreto font-data text-[11px]">
                {valor.toFixed(1)}
              </text>
            </g>
          )
        })}
        {series.map((serie) => (
          <path key={serie.key} d={pathSerie(serie.key)} fill="none" stroke={serie.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {puntos.map((punto, idx) => (
          <g key={`${punto.fecha}-${idx}`}>
            {series.map((serie) => {
              const valor = punto[serie.key]
              if (valor === null || valor === undefined) return null
              return (
                <circle key={serie.key} cx={x(idx)} cy={y(valor)} r="4" fill={serie.color}>
                  <title>{`${serie.label} ${formato(valor)} · ${punto.fecha ?? 'Sin fecha'}`}</title>
                </circle>
              )
            })}
          </g>
        ))}
      </svg>
    </div>
  )
}

function TablaHistorico({ puntos }: { puntos: FleetHistoricoPunto[] }) {
  return (
    <div className="overflow-hidden rounded-glass border border-concreto/15 bg-white/35">
      <table className="w-full border-collapse text-left font-body text-sm">
        <thead>
          <tr className="border-b border-concreto/15 bg-[color:var(--color-arena-suave)]">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-concreto">Fecha</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">Rd</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">H</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">T</th>
          </tr>
        </thead>
        <tbody>
          {puntos.map((punto, idx) => (
            <tr key={`${punto.fecha}-${idx}`} className="border-b border-concreto/10 last:border-b-0">
              <td className="px-3 py-2 text-concreto-oscuro">{punto.fecha ?? '—'}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.rd)}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.h)}</td>
              <td className="px-3 py-2 text-right font-data text-concreto-oscuro">{formato(punto.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
