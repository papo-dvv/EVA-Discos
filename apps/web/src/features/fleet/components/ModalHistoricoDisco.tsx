import { Activity, CalendarDays, Disc3, Rotate3D } from 'lucide-react'
import { useRef, useState } from 'react'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { useFleetHistorico } from '../queries'
import type { FleetDiscoDetalle, FleetHistoricoPunto } from '../types'

type Props = {
  disco: FleetDiscoDetalle
  onCerrar: () => void
}

type Metrica = 'rd' | 'h' | 't'

function formato(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : valor.toFixed(2)
}

export function ModalHistoricoDisco({ disco, onCerrar }: Props) {
  const historico = useFleetHistorico(disco.codigoDisco, disco.lado)
  const [metricaActiva, setMetricaActiva] = useState<Metrica>('rd')
  const graficaRef = useRef<HTMLDivElement>(null)

  function seleccionarMetrica(metrica: Metrica) {
    setMetricaActiva(metrica)
    graficaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <GlassModal
      titulo={`Disco ${disco.codigoDisco ?? 'sin código'} · ${disco.lado}`}
      onCerrar={onCerrar}
      ancho={960}
      altoMaximo="min(760px, calc(100dvh - 1.5rem))"
    >
      <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1 overscroll-contain">
        {historico.isLoading && <p className="py-8 text-center font-body text-sm text-concreto">Cargando histórico...</p>}
        {historico.isError && (
          <p role="alert" className="py-8 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el histórico del disco.
          </p>
        )}
        {historico.data && (
          <div className="space-y-4 pr-2">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <DiscoInteractivo3D disco={disco} metricaActiva={metricaActiva} />
              <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <DatoActual metrica="rd" activa={metricaActiva === 'rd'} etiqueta="Rd actual" valor={historico.data.actual.rd} tono="emerald" onSeleccionar={seleccionarMetrica} />
                <DatoActual metrica="h" activa={metricaActiva === 'h'} etiqueta="H actual" valor={historico.data.actual.h} tono="orange" onSeleccionar={seleccionarMetrica} />
                <DatoActual metrica="t" activa={metricaActiva === 't'} etiqueta="T actual" valor={historico.data.actual.t} tono="violet" onSeleccionar={seleccionarMetrica} />
              </div>
            </div>

            {historico.data.historico.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white/35 px-4 py-8 text-center font-body text-sm text-concreto">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <div ref={graficaRef}><GraficoHistorico puntos={historico.data.historico} metricaActiva={metricaActiva} onSeleccionar={setMetricaActiva} /></div>
                <TablaHistorico puntos={historico.data.historico} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </GlassModal>
  )
}

function DiscoInteractivo3D({ disco, metricaActiva }: { disco: FleetDiscoDetalle; metricaActiva: Metrica }) {
  const [giro, setGiro] = useState({ x: -8, y: -18 })
  const [girando, setGirando] = useState(false)
  const estado = disco.estadoCalculado ?? 'sin estado'
  const estadoColor =
    estado === 'CRITICO' || estado === 'CAMBIO'
      ? 'from-rose-500 to-orange-500'
      : estado === 'SEGUIMIENTO'
        ? 'from-amber-400 to-orange-500'
        : 'from-emerald-400 to-teal-600'
  const metrica = {
    rd: { etiqueta: 'Radio de desgaste (Rd)', color: '#34d399', halo: 'rgba(52,211,153,.75)' },
    h: { etiqueta: 'Altura de pestaña (H)', color: '#f97316', halo: 'rgba(249,115,22,.75)' },
    t: { etiqueta: 'Espesor total (T)', color: '#8b5cf6', halo: 'rgba(139,92,246,.75)' },
  }[metricaActiva]

  return (
    <section className="relative isolate min-h-[290px] overflow-hidden rounded-[1.8rem] border border-emerald-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-xl shadow-emerald-950/15">
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300"><Disc3 size={15} /> Gemelo digital</p>
          <h3 className="mt-1 font-display text-xl font-bold">{disco.codigoDisco ?? 'Disco sin código'}</h3>
          <p className="mt-1 text-xs text-slate-300">Lado {disco.lado} · posición {disco.posicion}</p>
        </div>
        <span className={`rounded-full bg-gradient-to-r ${estadoColor} px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white shadow-lg`}>{estado}</span>
      </div>

      <button
        type="button"
        aria-label="Rotar modelo tridimensional del disco"
        className="group relative z-10 mx-auto mt-1 block h-44 w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse' && !girando) return
          const rect = event.currentTarget.getBoundingClientRect()
          setGiro({
            x: ((event.clientY - rect.top) / rect.height - 0.5) * -30,
            y: ((event.clientX - rect.left) / rect.width - 0.5) * 55,
          })
        }}
        onPointerDown={(event) => {
          setGirando(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={() => setGirando(false)}
        onPointerCancel={() => setGirando(false)}
        onPointerLeave={() => { if (!girando) setGiro({ x: -8, y: -18 }) }}
      >
        <span className="absolute left-1/2 top-1/2 h-10 w-64 -translate-x-1/2 translate-y-10 rounded-full bg-black/60 blur-xl" />
        <span
          className="absolute left-1/2 top-1/2 block h-36 w-36 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-out"
          style={{ transform: `translate(-50%, -50%) perspective(650px) rotateX(${giro.x}deg) rotateY(${giro.y}deg)` }}
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-100 via-slate-500 to-slate-950 shadow-[inset_-12px_-10px_24px_rgba(0,0,0,.55),inset_9px_8px_18px_rgba(255,255,255,.8),10px_15px_20px_rgba(0,0,0,.45)]" />
          <span className="absolute inset-[10px] rounded-full border border-white/40 bg-[repeating-conic-gradient(from_0deg,#9ca3af_0deg,#e5e7eb_3deg,#6b7280_6deg)] opacity-80" />
          <span className="absolute inset-[24px] rounded-full border-[5px] border-slate-700 bg-gradient-to-br from-slate-300 via-slate-600 to-slate-900 shadow-inner" />
          <span className="absolute inset-[46px] rounded-full border-4 bg-slate-950 shadow-[inset_5px_4px_10px_#000] transition-colors" style={{ borderColor: metrica.color, boxShadow: `inset 5px 4px 10px #000, 0 0 0 7px ${metrica.halo.replace('.75', '.22')}` }} />
          <span className="absolute inset-[59px] rounded-full transition-colors" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${metrica.color} 35%, #082f2a)`, boxShadow: `0 0 20px ${metrica.halo}` }} />
          {[0, 60, 120, 180, 240, 300].map((angulo) => (
            <span key={angulo} className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full border border-white/50 bg-slate-900 shadow-inner" style={{ transform: `translate(-50%, -50%) rotate(${angulo}deg) translateY(-50px)` }} />
          ))}
        </span>
      </button>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[0.68rem] text-slate-300">
        <span className="inline-flex items-center gap-1.5"><Rotate3D size={14} style={{ color: metrica.color }} /> Visualizando: <strong className="text-white">{metrica.etiqueta}</strong></span>
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {disco.fechaUltimaMedicion ?? 'Sin medición'}</span>
      </div>
    </section>
  )
}

function DatoActual({ metrica, activa, etiqueta, valor, tono, onSeleccionar }: { metrica: Metrica; activa: boolean; etiqueta: string; valor: number | null | undefined; tono: 'emerald' | 'orange' | 'violet'; onSeleccionar: (metrica: Metrica) => void }) {
  const estilos = {
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-800',
    orange: 'border-orange-200 bg-gradient-to-br from-orange-50 to-white text-orange-800',
    violet: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-800',
  }
  return (
    <button type="button" aria-pressed={activa} onClick={() => onSeleccionar(metrica)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${estilos[tono]} ${activa ? 'ring-2 ring-current ring-offset-2' : 'opacity-80'}`}>
      <div><p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{etiqueta}</p><p className="mt-1 font-data text-2xl font-bold">{formato(valor)}</p></div>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><Activity size={20} /></span>
    </button>
  )
}

function GraficoHistorico({ puntos, metricaActiva, onSeleccionar }: { puntos: FleetHistoricoPunto[]; metricaActiva: Metrica; onSeleccionar: (metrica: Metrica) => void }) {
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
    <div className="rounded-[1.6rem] border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/40 to-emerald-50/50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {series.map((serie) => (
          <button type="button" key={serie.key} onClick={() => onSeleccionar(serie.key)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-xs font-semibold transition ${metricaActiva === serie.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 opacity-60'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: serie.color }} />
            {serie.label}
          </button>
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
          <path key={serie.key} d={pathSerie(serie.key)} fill="none" stroke={serie.color} strokeWidth={metricaActiva === serie.key ? 4 : 2} opacity={metricaActiva === serie.key ? 1 : 0.18} strokeLinecap="round" strokeLinejoin="round" className="transition-all" />
        ))}
        {puntos.map((punto, idx) => (
          <g key={`${punto.fecha}-${idx}`}>
            {series.map((serie) => {
              const valor = punto[serie.key]
              if (valor === null || valor === undefined) return null
              return (
                <circle key={serie.key} cx={x(idx)} cy={y(valor)} r={metricaActiva === serie.key ? 5 : 3} opacity={metricaActiva === serie.key ? 1 : 0.18} fill={serie.color}>
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
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/65 shadow-sm">
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
