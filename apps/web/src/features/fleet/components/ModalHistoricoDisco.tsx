import { GlassModal } from '../../../components/GlassModal'
import { RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { ScrollArea } from '../../../components/ScrollArea'
import { useFleetHistorico } from '../queries'
import type { FleetDiscoDetalle, FleetHistoricoPunto } from '../types'
import { ESTADO_META } from './estadoVisual'

type Props = {
  disco: FleetDiscoDetalle
  onCerrar: () => void
}

function formato(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : valor.toFixed(2)
}

export function ModalHistoricoDisco({ disco, onCerrar }: Props) {
  const historico = useFleetHistorico(disco.codigoDisco, disco.lado)
  const [indiceSeleccionado, setIndiceSeleccionado] = useState<number | null>(null)

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
        {historico.data && (() => {
          const puntos = historico.data.historico
          const indiceActivo = Math.min(indiceSeleccionado ?? Math.max(0, puntos.length - 1), Math.max(0, puntos.length - 1))
          const lecturaActiva = puntos[indiceActivo] ?? historico.data.actual
          const seleccionar = (indice: number) => setIndiceSeleccionado(indice)

          return <div className="space-y-4 pr-2">
            {/* La pieza se abre primero como objeto técnico 3D; debajo se
                separan lectura actual, evolución y registro para no mezclar
                toda la información de mantenimiento en una sola vista. */}
            <section aria-label="Ficha técnica y vista 3D" className="overflow-hidden rounded-glass border border-concreto/15 bg-white/35">
              <div className="grid lg:grid-cols-2">
                <div className="flex min-h-[20rem] items-center justify-center border-b border-concreto/10 bg-[radial-gradient(circle_at_50%_40%,rgba(63,169,95,0.3),transparent_58%)] p-5 lg:border-b-0 lg:border-r">
                  <Disco3DInteractivo
                    lectura={lecturaActiva}
                    indice={indiceActivo}
                    total={puntos.length}
                    onSiguiente={() => seleccionar((indiceActivo + 1) % Math.max(1, puntos.length))}
                  />
                </div>
                <div className="flex flex-col justify-center p-5 sm:p-6">
                  <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-verde-oscuro">Vista 3D del disco</p>
                  <h2 className="mt-1 font-display text-xl font-bold text-concreto-oscuro">Disco {disco.codigoDisco ?? 'sin código'} · {disco.lado}</h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-concreto">Arrastra para rotar. Presiona el disco para recorrer las mediciones; al seleccionar un punto de la gráfica, esta ficha se actualiza con la misma lectura.</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <DatoActual etiqueta="Rd" valor={lecturaActiva.rd} />
                    <DatoActual etiqueta="H" valor={lecturaActiva.h} />
                    <DatoActual etiqueta="T" valor={lecturaActiva.t} />
                  </div>
                  <ExplicacionLectura punto={lecturaActiva} indice={indiceActivo} total={puntos.length} />
                </div>
              </div>
            </section>

            {puntos.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white/35 px-4 py-8 text-center font-body text-sm text-concreto">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">2. Evolución y registro</p>
                <GraficoHistorico puntos={puntos} indiceSeleccionado={indiceActivo} onSeleccionar={seleccionar} />
                <TablaHistorico puntos={puntos} indiceSeleccionado={indiceActivo} onSeleccionar={seleccionar} />
              </>
            )}
          </div>
        })()}
      </ScrollArea>
    </GlassModal>
  )
}

function Disco3DInteractivo({ lectura, indice, total, onSiguiente }: { lectura: FleetHistoricoPunto; indice: number; total: number; onSiguiente: () => void }) {
  const [rotacion, setRotacion] = useState({ x: 52, y: -18 })
  const inicio = useRef<{ x: number; y: number; rotacionX: number; rotacionY: number; movio: boolean } | null>(null)
  const visual = visualEstadoDisco(lectura.estadoCalculado)

  function iniciarArrastre(evento: React.PointerEvent<HTMLButtonElement>) {
    inicio.current = {
      x: evento.clientX,
      y: evento.clientY,
      rotacionX: rotacion.x,
      rotacionY: rotacion.y,
      movio: false,
    }
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }

  function moverArrastre(evento: React.PointerEvent<HTMLButtonElement>) {
    if (!inicio.current) return
    if (Math.abs(evento.clientX - inicio.current.x) > 4 || Math.abs(evento.clientY - inicio.current.y) > 4) inicio.current.movio = true
    setRotacion({
      x: Math.max(-75, Math.min(75, inicio.current.rotacionX - (evento.clientY - inicio.current.y) * 0.55)),
      y: inicio.current.rotacionY + (evento.clientX - inicio.current.x) * 0.55,
    })
  }

  function terminarArrastre() {
    if (inicio.current && !inicio.current.movio) onSiguiente()
    inicio.current = null
  }

  return (
    <div className="flex w-full max-w-[19rem] shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        aria-label="Vista 3D interactiva del disco. Arrastra para rotar o presiona para ver la siguiente medición"
        className="touch-none cursor-grab rounded-full p-1 outline-none transition hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-emerald-500 active:cursor-grabbing"
        onPointerDown={iniciarArrastre}
        onPointerMove={moverArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault()
            onSiguiente()
          }
        }}
      >
        <span
          aria-hidden
          className="block h-60 w-60 rounded-full border-[18px] shadow-[inset_15px_15px_20px_rgba(255,255,255,0.7),inset_-17px_-17px_24px_rgba(15,23,42,0.7),0_22px_36px_rgba(15,92,57,0.28)] transition-transform duration-75 sm:h-64 sm:w-64"
          style={{
            background: visual.superficie,
            borderColor: visual.borde,
            boxShadow: `inset 15px 15px 20px rgba(255,255,255,0.7), inset -17px -17px 24px rgba(15,23,42,0.7), 0 22px 36px ${visual.sombra}`,
            transform: `perspective(260px) rotateX(${rotacion.x}deg) rotateY(${rotacion.y}deg)`,
          }}
        >
          <span className="m-auto block h-16 w-16 rounded-full bg-slate-200 shadow-[inset_6px_6px_9px_rgba(71,85,105,0.55),inset_-5px_-5px_8px_white]" />
        </span>
      </button>
      <div className="rounded-full border border-concreto/15 bg-white/75 px-3 py-1.5 text-center font-body text-[0.68rem] font-semibold text-concreto-oscuro shadow-sm">
        Lectura {total ? indice + 1 : 1} de {Math.max(1, total)} · {lectura.fecha ?? 'sin fecha'}
      </div>
      <span className="rounded-full px-3 py-1 font-body text-[0.62rem] font-bold uppercase tracking-[0.12em]" style={{ background: visual.fondoEtiqueta, color: visual.textoEtiqueta }}>
        {lectura.estadoCalculado ? ESTADO_META[lectura.estadoCalculado].etiqueta : 'Sin estado calculado'}
      </span>
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

function visualEstadoDisco(estado: FleetHistoricoPunto['estadoCalculado']) {
  const metal = 'repeating-conic-gradient(#eef4ef 0 7deg, #65766a 7deg 12deg)'
  if (estado === 'REPERFILADO') return { superficie: 'repeating-conic-gradient(#f7fffa 0 6deg, #94d8b0 6deg 11deg, #e5f8ea 11deg 16deg)', borde: '#167543', sombra: 'rgba(22,117,67,0.32)', fondoEtiqueta: '#dcfce7', textoEtiqueta: '#167543' }
  if (estado === 'CRITICO') return { superficie: 'repeating-conic-gradient(#fff1f2 0 7deg, #d66b6b 7deg 12deg, #772f35 12deg 16deg)', borde: '#991b1b', sombra: 'rgba(153,27,27,0.35)', fondoEtiqueta: '#fee2e2', textoEtiqueta: '#991b1b' }
  if (estado === 'CAMBIO') return { superficie: 'repeating-conic-gradient(#fff8e8 0 7deg, #f2a84a 7deg 12deg, #9a5b18 12deg 16deg)', borde: '#c66e16', sombra: 'rgba(198,110,22,0.32)', fondoEtiqueta: '#ffedd5', textoEtiqueta: '#9a5b18' }
  if (estado === 'SEGUIMIENTO') return { superficie: 'repeating-conic-gradient(#fffce9 0 7deg, #d5ae41 7deg 12deg, #7c6424 12deg 16deg)', borde: '#a67c14', sombra: 'rgba(166,124,20,0.3)', fondoEtiqueta: '#fef3c7', textoEtiqueta: '#854d0e' }
  return { superficie: metal, borde: '#334155', sombra: 'rgba(15,92,57,0.28)', fondoEtiqueta: '#dcfce7', textoEtiqueta: '#167543' }
}

function ExplicacionLectura({ punto, indice, total }: { punto: FleetHistoricoPunto; indice: number; total: number }) {
  const estado = punto.estadoCalculado ? ESTADO_META[punto.estadoCalculado] : null
  return (
    <div className="mt-4 border-t border-concreto/10 pt-3">
      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-concreto">Interpretación de la lectura</p>
      <p className="mt-1 font-body text-xs leading-relaxed text-concreto">
        Medición {total ? indice + 1 : 1} de {Math.max(1, total)}{punto.fecha ? ` · ${punto.fecha}` : ''}.{' '}
        {estado ? `Estado calculado: ${estado.etiqueta}; se determina a partir de los valores registrados de Rd, H y T.` : 'No hay un estado calculado para esta medición.'}
      </p>
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

function GraficoHistorico({ puntos, indiceSeleccionado, onSeleccionar }: { puntos: FleetHistoricoPunto[]; indiceSeleccionado: number; onSeleccionar: (indice: number) => void }) {
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
            {idx === indiceSeleccionado && <line x1={x(idx)} y1={padY} x2={x(idx)} y2={alto - padY} stroke="rgba(15,92,57,0.35)" strokeWidth="2" strokeDasharray="4 4" />}
            {series.map((serie) => {
              const valor = punto[serie.key]
              if (valor === null || valor === undefined) return null
              return (
                <circle
                  key={serie.key}
                  cx={x(idx)}
                  cy={y(valor)}
                  r={idx === indiceSeleccionado ? 6 : 4}
                  fill={serie.color}
                  stroke={idx === indiceSeleccionado ? 'white' : 'none'}
                  strokeWidth="2"
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onPointerEnter={() => onSeleccionar(idx)}
                  onClick={() => onSeleccionar(idx)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter' || evento.key === ' ') onSeleccionar(idx)
                  }}
                >
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

function TablaHistorico({ puntos, indiceSeleccionado, onSeleccionar }: { puntos: FleetHistoricoPunto[]; indiceSeleccionado: number; onSeleccionar: (indice: number) => void }) {
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
            <tr key={`${punto.fecha}-${idx}`} onMouseEnter={() => onSeleccionar(idx)} onClick={() => onSeleccionar(idx)} className={`cursor-pointer border-b border-concreto/10 transition last:border-b-0 ${idx === indiceSeleccionado ? 'bg-emerald-50/75' : 'hover:bg-white/60'}`}>
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
