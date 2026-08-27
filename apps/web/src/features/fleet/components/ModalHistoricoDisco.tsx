import { Activity, CalendarDays, Disc3, Rotate3D } from 'lucide-react'
import { animate } from 'animejs'
import { useEffect, useRef, useState } from 'react'
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

  return (
    <GlassModal
      titulo={`Disco ${disco.codigoDisco ?? 'sin código'} · ${disco.lado}`}
      onCerrar={onCerrar}
      ancho={960}
      altoMaximo="min(760px, calc(100dvh - 1.5rem))"
    >
      <ScrollArea
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName="min-h-0 flex-1 overscroll-contain pr-1"
      >
        {historico.isLoading && <p className="py-8 text-center font-body text-sm text-concreto">Cargando histórico...</p>}
        {historico.isError && (
          <p role="alert" className="py-8 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el histórico del disco.
          </p>
        )}
        {historico.data && (
          <div className="space-y-4 pr-2">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <DiscoInteractivo3D
                disco={disco}
                actual={historico.data.actual}
                metricaActiva={metricaActiva}
                onSeleccionar={setMetricaActiva}
              />
              <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <DatoActual metrica="rd" activa={metricaActiva === 'rd'} etiqueta="Rd actual" valor={historico.data.actual.rd} tono="emerald" onSeleccionar={setMetricaActiva} />
                <DatoActual metrica="h" activa={metricaActiva === 'h'} etiqueta="H actual" valor={historico.data.actual.h} tono="orange" onSeleccionar={setMetricaActiva} />
                <DatoActual metrica="t" activa={metricaActiva === 't'} etiqueta="T actual" valor={historico.data.actual.t} tono="violet" onSeleccionar={setMetricaActiva} />
              </div>
            </div>

            {historico.data.historico.length === 0 ? (
              <div className="rounded-glass border border-concreto/15 bg-white px-4 py-8 text-center font-body text-sm text-concreto shadow-sm">
                Este disco no tiene mediciones confirmadas.
              </div>
            ) : (
              <>
                <NavegadorHistorico
                  actual={historico.data.actual}
                  metricaActiva={metricaActiva}
                  onSeleccionar={setMetricaActiva}
                />
                <TablaHistorico puntos={historico.data.historico} />
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </GlassModal>
  )
}

function NavegadorHistorico({ actual, metricaActiva, onSeleccionar }: {
  actual: FleetHistoricoPunto
  metricaActiva: Metrica
  onSeleccionar: (metrica: Metrica) => void
}) {
  const metricas = [
    { key: 'rd' as const, etiqueta: 'Rd', descripcion: 'Radio de desgaste', valor: actual.rd, color: '#059669' },
    { key: 'h' as const, etiqueta: 'H', descripcion: 'Altura', valor: actual.h, color: '#ea580c' },
    { key: 't' as const, etiqueta: 'T', descripcion: 'Espesor', valor: actual.t, color: '#7c3aed' },
  ]

  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-md shadow-slate-900/10 backdrop-blur-md">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="hidden shrink-0 px-2 font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:inline">Histórico</span>
        {metricas.map((item) => {
          const activa = item.key === metricaActiva
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={activa}
              onClick={() => onSeleccionar(item.key)}
              className={`flex min-w-[104px] flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition ${activa ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-100'}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span><span className={`block text-[0.62rem] font-bold uppercase tracking-wider ${activa ? 'text-slate-300' : 'text-slate-500'}`}>{item.etiqueta} · {item.descripcion}</span><span className="block font-data text-base font-bold">{formato(item.valor)}</span></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DiscoInteractivo3D({
  disco,
  actual,
  metricaActiva,
  onSeleccionar,
}: {
  disco: FleetDiscoDetalle
  actual: FleetHistoricoPunto
  metricaActiva: Metrica
  onSeleccionar: (metrica: Metrica) => void
}) {
  const [giro, setGiro] = useState({ x: 0, y: 0 })
  const [girando, setGirando] = useState(false)
  const [vista, setVista] = useState<'3d' | '2d'>('3d')
  const modeloRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (disco.posicion !== 'unica' || vista !== '3d' || !modeloRef.current) return
    const animacion = animate(modeloRef.current, {
      rotateY: [0, 18, 0],
      rotateX: [0, -4, 0],
      duration: 5200,
      ease: 'inOutSine',
      loop: true,
    })
    return () => {
      animacion.pause()
    }
  }, [disco.posicion, vista])
  const metrica = {
    rd: { etiqueta: 'Radio de desgaste (Rd)', color: '#34d399', halo: 'rgba(52,211,153,.75)' },
    h: { etiqueta: 'Altura de pestaña (H)', color: '#f97316', halo: 'rgba(249,115,22,.75)' },
    t: { etiqueta: 'Espesor total (T)', color: '#8b5cf6', halo: 'rgba(139,92,246,.75)' },
  }[metricaActiva]
  const metricas = [
    { key: 'rd' as const, etiqueta: 'Rd', valor: actual.rd, color: '#34d399' },
    { key: 'h' as const, etiqueta: 'H', valor: actual.h, color: '#f97316' },
    { key: 't' as const, etiqueta: 'T', valor: actual.t, color: '#8b5cf6' },
  ]

  return (
    <section className="relative isolate min-h-[290px] overflow-hidden rounded-[1.8rem] border border-emerald-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-xl shadow-emerald-950/15">
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-20 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-emerald-300"><Disc3 size={15} /> Gemelo digital</p>
          <h3 className="mt-1 font-display text-xl font-bold">{disco.codigoDisco ?? 'Disco sin código'}</h3>
          <p className="mt-1 text-xs text-slate-300">Lado {disco.lado} · posición {disco.posicion}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-xl border border-white/15 bg-slate-950/45 p-0.5 text-[0.62rem] font-bold">
            {(['3d', '2d'] as const).map((opcion) => <button key={opcion} type="button" aria-pressed={vista === opcion} onClick={() => setVista(opcion)} className={`rounded-lg px-2 py-1 transition ${vista === opcion ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>{opcion.toUpperCase()}</button>)}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label={`${vista === '3d' ? 'Rotar modelo tridimensional' : 'Vista técnica bidimensional'} del disco; métrica activa ${metrica.etiqueta}`}
        className={`group relative z-10 mx-auto mt-5 block h-52 w-full select-none ${vista === '3d' ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-default'}`}
        onPointerMove={(event) => {
          if (vista !== '3d') return
          if (event.pointerType !== 'mouse' && !girando) return
          const rect = event.currentTarget.getBoundingClientRect()
          setGiro({
            x: ((event.clientY - rect.top) / rect.height - 0.5) * -30,
            y: ((event.clientX - rect.left) / rect.width - 0.5) * 55,
          })
        }}
        onPointerDown={(event) => {
          if (vista !== '3d') return
          setGirando(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={() => setGirando(false)}
        onPointerCancel={() => setGirando(false)}
        onPointerLeave={() => { if (!girando) setGiro({ x: 0, y: 0 }) }}
      >
        <span className="absolute left-1/2 top-1/2 h-8 w-52 -translate-x-1/2 translate-y-9 rounded-full bg-black/60 blur-xl" />
        <span
          ref={modeloRef}
          className="absolute left-1/2 top-1/2 block h-44 w-44 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-out"
          style={{ transform: vista === '3d' ? `translate(-50%, -50%) perspective(650px) rotateX(${giro.x}deg) rotateY(${giro.y}deg)` : 'translate(-50%, -50%)' }}
        >
          {disco.posicion === 'unica' && <span className="absolute left-1/2 top-1/2 h-9 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-slate-200 via-slate-500 to-slate-800 shadow-[0_8px_16px_rgba(0,0,0,.55)]" />}
          <span className={`absolute inset-0 rounded-full ${vista === '3d' ? 'bg-gradient-to-br from-slate-100 via-slate-500 to-slate-950 shadow-[inset_-12px_-10px_24px_rgba(0,0,0,.55),inset_9px_8px_18px_rgba(255,255,255,.8),10px_15px_20px_rgba(0,0,0,.45)]' : 'border-2 border-slate-300 bg-slate-950/80 shadow-[0_0_0_8px_rgba(255,255,255,.08)]'}`} />
          <span className={`absolute inset-[9px] rounded-full border ${vista === '3d' ? 'border-white/40 bg-[repeating-conic-gradient(from_0deg,#9ca3af_0deg,#e5e7eb_3deg,#6b7280_6deg)] opacity-80' : 'border-emerald-400/70'}`} />
          <span className="absolute inset-[22px] rounded-full border-[5px] border-slate-700 bg-gradient-to-br from-slate-300 via-slate-600 to-slate-900 shadow-inner" />
          <span className="absolute inset-[42px] rounded-full border-4 bg-slate-950 shadow-[inset_5px_4px_10px_#000] transition-colors" style={{ borderColor: metrica.color, boxShadow: `inset 5px 4px 10px #000, 0 0 0 7px ${metrica.halo.replace('.75', '.22')}` }} />
          <span className="absolute inset-[54px] rounded-full transition-colors" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${metrica.color} 35%, #082f2a)`, boxShadow: `0 0 20px ${metrica.halo}` }} />
          {vista === '3d' && [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angulo) => <span key={angulo} className="absolute left-1/2 top-1/2 h-3 w-1.5 rounded-full border border-amber-100/50 bg-amber-900/80 shadow-inner" style={{ transform: `translate(-50%, -50%) rotate(${angulo}deg) translateY(-72px)` }} />)}
        </span>
      </button>

      <div className="relative z-10 mx-auto -mt-2 grid w-full max-w-sm grid-cols-3 gap-2" aria-label="Métricas del disco">
        {metricas.map((item) => {
          const activa = item.key === metricaActiva
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={activa}
              onClick={() => onSeleccionar(item.key)}
              className={`rounded-xl border px-2 py-1.5 text-left transition ${activa ? 'border-white/70 bg-white/20 shadow-lg' : 'border-white/10 bg-slate-950/25 hover:bg-white/10'}`}
              style={activa ? { boxShadow: `0 0 0 1px ${item.color}66, 0 8px 18px ${item.color}22` } : undefined}
            >
              <span className="block text-[0.6rem] font-bold uppercase tracking-[0.16em] text-slate-300">{item.etiqueta}</span>
              <span className="mt-0.5 block font-data text-base font-bold" style={{ color: activa ? item.color : '#fff' }}>{formato(item.valor)}</span>
            </button>
          )
        })}
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[0.68rem] text-slate-300">
        <span className="inline-flex items-center gap-1.5"><Rotate3D size={14} style={{ color: metrica.color }} /> Visualizando: <strong className="text-white">{metrica.etiqueta} · {formato(actual[metricaActiva])}</strong></span>
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

function TablaHistorico({ puntos }: { puntos: FleetHistoricoPunto[] }) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/65 shadow-sm">
      <table className="w-full border-collapse text-left font-body text-sm">
        <thead className="sticky top-0 z-10 shadow-sm">
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
