import { AlertTriangle, ArrowRight, Search, ShieldCheck, TrainFront, Wrench } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeEstadoFlota } from '../features/fleet/components/BadgeEstadoFlota'
import { useFleetSummary } from '../features/fleet/queries'
import type { FleetSummaryItem } from '../features/fleet/types'

type FiltroEstado = 'todos' | 'operativo' | 'alerta'

function totalAlertas(tren: FleetSummaryItem) {
  return tren.conteoAlerta.cambio + tren.conteoAlerta.critico + tren.conteoAlerta.reperfilado
}

function estadoTren(tren: FleetSummaryItem) {
  if (tren.conteoAlerta.critico > 0 || tren.conteoAlerta.cambio > 0) return 'alerta'
  return totalAlertas(tren) > 0 ? 'seguimiento' : 'operativo'
}

export function Flota() {
  const summary = useFleetSummary()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')

  const trenes = useMemo(() => {
    const texto = busqueda.trim().replace(/^t/i, '')
    return (summary.data ?? []).filter((tren) => {
      const estado = estadoTren(tren)
      return (!texto || String(tren.tren).includes(texto)) &&
        (filtro === 'todos' || (filtro === 'alerta' ? estado !== 'operativo' : estado === filtro))
    })
  }, [summary.data, busqueda, filtro])

  const estadisticas = useMemo(() => {
    const todos = summary.data ?? []
    return {
      total: todos.length,
      operativos: todos.filter((tren) => estadoTren(tren) === 'operativo').length,
      alerta: todos.filter((tren) => estadoTren(tren) !== 'operativo').length,
      criticos: todos.filter((tren) => tren.conteoAlerta.critico > 0).length,
    }
  }, [summary.data])

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-800">Flota</h1>
          <p className="mt-1 text-sm text-slate-500">Supervisión operativa de trenes y estado de discos de freno</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Información actualizada
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Total de trenes" valor={estadisticas.total} icono={<TrainFront size={18} />} tono="slate" />
        <Kpi etiqueta="Operativos" valor={estadisticas.operativos} icono={<ShieldCheck size={18} />} tono="green" />
        <Kpi etiqueta="Requieren atención" valor={estadisticas.alerta} icono={<Wrench size={18} />} tono="amber" />
        <Kpi etiqueta="Críticos" valor={estadisticas.criticos} icono={<AlertTriangle size={18} />} tono="red" />
      </div>

      <section className="eva-panel mt-4 p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="eva-control w-full py-2 pl-9 pr-3 text-sm" placeholder="Buscar por número de tren..." value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
          </label>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {([['todos', 'Todos'], ['operativo', 'Operativos'], ['alerta', 'Con alertas']] as const).map(([valor, etiqueta]) => (
              <button key={valor} type="button" onClick={() => setFiltro(valor)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filtro === valor ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </section>

      {summary.isLoading && <p className="py-16 text-center text-sm text-slate-500">Cargando flota...</p>}
      {summary.isError && <p role="alert" className="py-16 text-center text-sm text-red-600">No se pudo cargar el resumen de flota.</p>}
      {summary.data && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{trenes.length} trenes encontrados</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {trenes.map((tren) => <TarjetaTren key={tren.tren} tren={tren} />)}
          </div>
          {trenes.length === 0 && <div className="eva-panel mt-4 py-16 text-center text-sm text-slate-500">No hay trenes que coincidan con los filtros.</div>}
        </>
      )}
    </div>
  )
}

function Kpi({ etiqueta, valor, icono, tono }: { etiqueta: string; valor: number; icono: ReactNode; tono: 'slate' | 'green' | 'amber' | 'red' }) {
  const clases = { slate: 'bg-slate-100 text-slate-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' }[tono]
  return <div className="eva-panel flex items-center gap-3 p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${clases}`}>{icono}</span><div><p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</p><p className="mt-0.5 font-data text-2xl font-bold text-slate-800">{valor}</p></div></div>
}

function TarjetaTren({ tren }: { tren: FleetSummaryItem }) {
  const estado = estadoTren(tren)
  const meta = {
    operativo: { texto: 'Operativo', borde: 'border-emerald-300', punto: 'bg-emerald-500', fondo: 'from-emerald-50/80' },
    seguimiento: { texto: 'Seguimiento', borde: 'border-amber-300', punto: 'bg-amber-400', fondo: 'from-amber-50/80' },
    alerta: { texto: 'Atención', borde: 'border-red-300', punto: 'bg-red-500', fondo: 'from-red-50/80' },
  }[estado]
  const alertas = [
    { estado: 'CAMBIO' as const, conteo: tren.conteoAlerta.cambio },
    { estado: 'CRITICO' as const, conteo: tren.conteoAlerta.critico },
    { estado: 'REPERFILADO' as const, conteo: tren.conteoAlerta.reperfilado },
  ].filter((alerta) => alerta.conteo > 0)

  return (
    <Link to={`/fleet/${tren.tren}`} className={`group overflow-hidden rounded-2xl border bg-gradient-to-b ${meta.fondo} to-white shadow-[0_12px_34px_-24px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_-22px_rgba(15,23,42,0.38)] ${meta.borde}`}>
      <div className="relative flex h-36 items-center justify-center overflow-hidden border-b border-slate-200/70 bg-white">
        <div className={`absolute h-24 w-24 rounded-full blur-3xl ${meta.punto} opacity-20`} />
        <img
          src="/images/mediciones-tren-alerta-alstom.png"
          alt="Tren ALSTOM"
          className="absolute inset-0 h-full w-full object-cover object-left transition-transform duration-500 group-hover:scale-[1.025]"
        />
        <span className="absolute right-3 top-3 rounded-full border border-emerald-200 bg-white/85 px-2 py-1 text-[0.65rem] font-bold text-emerald-700">ALSTOM</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-slate-400">Unidad</p><h2 className="mt-0.5 text-xl font-bold text-slate-800">Tren {tren.tren}</h2></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-slate-600 shadow-sm"><span className={`h-2 w-2 rounded-full ${meta.punto}`} />{meta.texto}</span>
        </div>
        <div className="mt-4 border-y border-slate-100 py-3"><p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Última medición</p><p className="mt-1 font-data text-sm font-semibold text-slate-700">{tren.fechaUltimaMedicion ?? 'Sin datos registrados'}</p></div>
        <div className="mt-3 flex min-h-7 items-center justify-between gap-2"><div className="flex flex-wrap gap-1">{alertas.length ? alertas.map((alerta) => <BadgeEstadoFlota key={alerta.estado} estado={alerta.estado} conteo={alerta.conteo} />) : <span className="text-xs font-medium text-emerald-700">Sin alertas activas</span>}</div><ArrowRight size={17} className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" /></div>
      </div>
    </Link>
  )
}
