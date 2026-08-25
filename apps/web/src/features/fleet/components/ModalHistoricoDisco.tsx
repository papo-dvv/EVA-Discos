import { GlassModal } from '../../../components/GlassModal'
import { RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
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
            {/* La pieza se abre primero como objeto técnico 3D; debajo se
                separan lectura actual, evolución y registro para no mezclar
                toda la información de mantenimiento en una sola vista. */}
            <section aria-label="Ficha técnica y vista 3D" className="overflow-hidden rounded-glass border border-concreto/15 bg-white/35">
              <div className="grid lg:grid-cols-2">
                <div className="flex min-h-[20rem] items-center justify-center border-b border-concreto/10 bg-[radial-gradient(circle_at_50%_40%,rgba(63,169,95,0.3),transparent_58%)] p-5 lg:border-b-0 lg:border-r">
                  <Disco3DInteractivo />
                </div>
                <div className="flex flex-col justify-center p-5 sm:p-6">
                  <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-verde-oscuro">Vista 3D del disco</p>
                  <h2 className="mt-1 font-display text-xl font-bold text-concreto-oscuro">Disco {disco.codigoDisco ?? 'sin código'} · {disco.lado}</h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-concreto">Arrastra el disco para revisarlo desde cualquier ángulo. La ficha conserva las mismas lecturas técnicas del historial de mediciones.</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <DatoActual etiqueta="Rd actual" valor={historico.data.actual.rd} />
                    <DatoActual etiqueta="H actual" valor={historico.data.actual.h} />
                    <DatoActual etiqueta="T actual" valor={historico.data.actual.t} />
                  </div>
                  <p className="mt-4 border-t border-concreto/10 pt-3 font-body text-xs text-concreto">Los valores corresponden a la última medición confirmada del disco seleccionado.</p>
                </div>
              </div>
            </section>

            {historico.data.historico.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white/35 px-4 py-8 text-center font-body text-sm text-concreto">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">2. Evolución y registro</p>
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

function Disco3DInteractivo() {
  const [rotacion, setRotacion] = useState({ x: 52, y: -18 })
  const inicio = useRef<{ x: number; y: number; rotacionX: number; rotacionY: number } | null>(null)

  function iniciarArrastre(evento: React.PointerEvent<HTMLButtonElement>) {
    inicio.current = {
      x: evento.clientX,
      y: evento.clientY,
      rotacionX: rotacion.x,
      rotacionY: rotacion.y,
    }
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }

  function moverArrastre(evento: React.PointerEvent<HTMLButtonElement>) {
    if (!inicio.current) return
    setRotacion({
      x: Math.max(-75, Math.min(75, inicio.current.rotacionX - (evento.clientY - inicio.current.y) * 0.55)),
      y: inicio.current.rotacionY + (evento.clientX - inicio.current.x) * 0.55,
    })
  }

  function terminarArrastre() {
    inicio.current = null
  }

  return (
    <div className="flex w-full max-w-[19rem] shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        aria-label="Vista 3D interactiva del disco. Arrastra para rotar"
        className="touch-none cursor-grab rounded-full p-1 outline-none transition hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-emerald-500 active:cursor-grabbing"
        onPointerDown={iniciarArrastre}
        onPointerMove={moverArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
      >
        <span
          aria-hidden
          className="block h-60 w-60 rounded-full border-[18px] border-slate-700 shadow-[inset_15px_15px_20px_rgba(255,255,255,0.7),inset_-17px_-17px_24px_rgba(15,23,42,0.7),0_22px_36px_rgba(15,92,57,0.28)] transition-transform duration-75 sm:h-64 sm:w-64"
          style={{
            background: 'repeating-conic-gradient(#dbe4dc 0 7deg, #637267 7deg 12deg)',
            transform: `perspective(260px) rotateX(${rotacion.x}deg) rotateY(${rotacion.y}deg)`,
          }}
        >
          <span className="m-auto block h-16 w-16 rounded-full bg-slate-200 shadow-[inset_6px_6px_9px_rgba(71,85,105,0.55),inset_-5px_-5px_8px_white]" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setRotacion({ x: 52, y: -18 })}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[0.62rem] font-semibold text-concreto transition hover:bg-white/65 hover:text-verde-oscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <RotateCcw size={11} aria-hidden />
        Reiniciar vista
      </button>
    </div>
  )
}

function DatoActual({ etiqueta, valor }: { etiqueta: string; valor: number | null | undefined }) {
  return (
    <div className="rounded-xl border border-concreto/15 bg-white/55 px-3 py-2.5">
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">{etiqueta}</p>
      <p className="mt-1 font-data text-xl font-semibold text-concreto-oscuro">{formato(valor)}</p>
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
