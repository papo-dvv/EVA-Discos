import { AlertTriangle, ChevronDown, ChevronRight, Clock3, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { useDetallePronostico } from '../queries'
import type { EventoPronostico } from '../types'
import type { DatoBarra } from './GraficoBarrasPronostico'

// Detalle por mes, fleet-wide (sin `tren` — la pestaña Gráfico de Barras no
// tiene alcance por tren, ver Proyeccion.tsx). Adaptado del patrón
// "Detalle por mes" de EVA-Aldy (ProyeccionCambiosView.tsx, tab
// proyeccion_cambios) a discos en vez de ruedas, y a 2 tipos de evento
// (Reperfilado + Cambio) en vez de solo cambio — por eso cada coche muestra
// hasta 2 sub-listas independientes.
type CocheGrupo = {
  trenNumero: number
  numeroCoche: number
  tipoCoche: string
  reperfilados: EventoPronostico[]
  cambios: EventoPronostico[]
}
type TrenGrupo = {
  trenNumero: number
  coches: CocheGrupo[]
}

function resumenTren(tren: TrenGrupo) {
  const reperfilados = tren.coches.reduce((total, coche) => total + coche.reperfilados.length, 0)
  const cambios = tren.coches.reduce((total, coche) => total + coche.cambios.length, 0)
  const diasMasProximos = Math.min(
    ...tren.coches.flatMap((coche) => [...coche.reperfilados, ...coche.cambios].map((evento) => evento.diasHastaEvento)),
  )
  return { reperfilados, cambios, diasMasProximos }
}

function agruparPorTrenYCoche(reperfilados: EventoPronostico[], cambios: EventoPronostico[]): TrenGrupo[] {
  const porTren = new Map<number, Map<number, CocheGrupo>>()

  function acumular(eventos: EventoPronostico[], clave: 'reperfilados' | 'cambios') {
    for (const evento of eventos) {
      const posicion = evento.posiciones[0]
      if (!posicion) continue
      if (!porTren.has(evento.trenNumero)) porTren.set(evento.trenNumero, new Map())
      const porCoche = porTren.get(evento.trenNumero)!
      if (!porCoche.has(posicion.numeroCoche)) {
        porCoche.set(posicion.numeroCoche, {
          trenNumero: evento.trenNumero,
          numeroCoche: posicion.numeroCoche,
          tipoCoche: posicion.tipoCoche,
          reperfilados: [],
          cambios: [],
        })
      }
      porCoche.get(posicion.numeroCoche)![clave].push(evento)
    }
  }
  acumular(reperfilados, 'reperfilados')
  acumular(cambios, 'cambios')

  return Array.from(porTren.entries())
    .map(([trenNumero, porCoche]) => ({
      trenNumero,
      coches: Array.from(porCoche.values()).sort((a, b) => a.numeroCoche - b.numeroCoche),
    }))
    // Orden operativo: cambios primero, luego volumen de reperfilados y al
    // final la fecha más próxima. Así cada mes abre los trenes críticos arriba.
    .sort((a, b) => {
      const resumenA = resumenTren(a)
      const resumenB = resumenTren(b)
      if (resumenA.cambios !== resumenB.cambios) return resumenB.cambios - resumenA.cambios
      if (resumenA.reperfilados !== resumenB.reperfilados) return resumenB.reperfilados - resumenA.reperfilados
      if (resumenA.diasMasProximos !== resumenB.diasMasProximos) return resumenA.diasMasProximos - resumenB.diasMasProximos
      return a.trenNumero - b.trenNumero
    })
}

function TablaEventos({ titulo, eventos }: { titulo: string; eventos: EventoPronostico[] }) {
  if (eventos.length === 0) return null
  const esCambio = titulo.toLowerCase().includes('cambiar')
  const acento = esCambio
    ? 'border-red-200 bg-red-50/45 text-red-700'
    : 'border-amber-200 bg-amber-50/45 text-amber-700'
  return (
    <div className={`mt-3 overflow-x-auto rounded-xl border ${acento}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="flex items-center gap-1.5 font-body text-xs font-bold">
          {esCambio ? <AlertTriangle size={14} aria-hidden /> : <Clock3 size={14} aria-hidden />}
          {titulo}
        </p>
        <span className="rounded-full bg-white/80 px-2 py-0.5 font-data text-[0.65rem] font-bold">{eventos.length}</span>
      </div>
      <table className="w-full text-left font-body text-[0.75rem]">
        <thead className="border-y border-concreto/10 bg-white/70 text-[0.68rem] uppercase tracking-[0.08em]">
          <tr>
            <th className="px-3 py-1.5 font-semibold text-concreto">Bogie</th>
            <th className="px-3 py-1.5 text-right font-semibold text-concreto">Eje</th>
            <th className="px-3 py-1.5 font-semibold text-concreto">Lado</th>
            <th className="px-3 py-1.5 font-semibold text-concreto">Última medición</th>
            <th className="px-3 py-1.5 text-right font-semibold text-concreto">Días</th>
            <th className="px-3 py-1.5 font-semibold text-concreto">Fecha estimada</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento, indice) => (
            <tr
              key={`${evento.fechaEstimada}-${evento.trenNumero}-${indice}`}
              className="border-t border-concreto/10 bg-white/25 transition-colors hover:bg-white/70"
            >
              <td className="px-3 py-1.5 text-concreto-oscuro">{evento.posiciones[0]?.bogieCodigo}</td>
              <td className="px-3 py-1.5 text-right font-data text-concreto-oscuro">
                {evento.posiciones[0]?.ejeNumero}
              </td>
              <td className="px-3 py-1.5 capitalize text-concreto-oscuro">
                {evento.posiciones.map((posicion) => posicion.lado).join(' / ')}
              </td>
              <td className="px-3 py-1.5 font-data text-concreto-oscuro">{evento.fechaUltimaMedicion}</td>
              <td className="px-3 py-1.5 text-right">
                <span className={`rounded-full px-2 py-0.5 font-data text-[0.68rem] font-bold ${esCambio ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {evento.diasHastaEvento} d
                </span>
              </td>
              <td className="px-3 py-1.5">
                <span className="font-data text-concreto-oscuro">{evento.fechaEstimada}</span>
                {evento.pendiente && (
                  <span className="ml-1.5 rounded-full bg-[color:var(--color-estado-seguimiento)]/20 px-1.5 py-0.5 text-[0.625rem] font-semibold text-[color:var(--color-estado-seguimiento)]">
                    Pendiente
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetalleMesContenido({ periodo }: { periodo: string }) {
  const navigate = useNavigate()
  const reperfilados = useDetallePronostico(undefined, periodo, 'REPERFILADO')
  const cambios = useDetallePronostico(undefined, periodo, 'CAMBIO')
  const cargando = reperfilados.isLoading || cambios.isLoading

  const trenes = useMemo(
    () => agruparPorTrenYCoche(reperfilados.data ?? [], cambios.data ?? []),
    [reperfilados.data, cambios.data],
  )

  if (cargando) {
    return <p className="px-3 py-4 font-body text-sm text-concreto">Cargando…</p>
  }
  if (trenes.length === 0) {
    return <p className="px-3 py-4 font-body text-sm text-concreto">Sin eventos proyectados este mes.</p>
  }

  return (
    <div className="space-y-3 px-3 pb-3">
      <div className="rounded-lg border border-concreto/15 bg-white/45 px-3 py-2">
        <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.12em] text-concreto">Orden de atención</p>
        <p className="mt-0.5 font-body text-xs text-concreto">Cambios primero; luego reperfilados y fecha más próxima.</p>
      </div>
      {trenes.map((tren) => {
        const resumen = resumenTren(tren)
        const esPrioridad = resumen.cambios > 0
        return (
        <details key={tren.trenNumero} className={`overflow-hidden rounded-xl border bg-white/50 ${esPrioridad ? 'border-red-200/80' : 'border-amber-200/80'}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-l-4 border-transparent px-3 py-3 transition-colors hover:bg-white/70 [&::-webkit-details-marker]:hidden" style={{ borderLeftColor: esPrioridad ? 'var(--color-estado-critico)' : 'var(--color-estado-seguimiento)' }}>
            <span className="flex items-center gap-2">
              <span className="font-body text-sm font-semibold text-concreto-oscuro">Tren {tren.trenNumero}</span>
              <span className={`rounded-full px-2 py-0.5 font-body text-[0.65rem] font-bold ${esPrioridad ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {esPrioridad ? 'Prioridad · cambio' : 'Seguimiento · reperfilado'}
              </span>
            </span>
            <span className="hidden font-body text-xs text-concreto sm:inline">{resumen.cambios} cambios · {resumen.reperfilados} reperfilados · {tren.coches.length} coches</span>
          </summary>
          <div className="space-y-3 bg-slate-50/35 p-3">
            {tren.coches.map((coche) => (
              <div key={coche.numeroCoche} className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <span className="font-body text-sm font-semibold text-concreto-oscuro">
                    Coche {coche.tipoCoche} <span className="font-normal text-concreto">· N.° {coche.numeroCoche}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/operaciones?tren=${coche.trenNumero}&coche=${coche.numeroCoche}`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-verde-institucional/30 bg-verde-claro/60 px-2.5 py-1 font-body text-xs font-semibold text-verde-oscuro transition-colors hover:bg-verde-claro"
                  >
                    <Wrench size={12} strokeWidth={2.5} />
                    Ir a Operaciones →
                  </button>
                </div>
                <TablaEventos titulo="A reperfilar" eventos={coche.reperfilados} />
                <TablaEventos titulo="A cambiar" eventos={coche.cambios} />
              </div>
            ))}
          </div>
        </details>
        )
      })}
    </div>
  )
}

type Props = {
  meses: DatoBarra[]
}

export function DetalleMesProyeccion({ meses }: Props) {
  const [mesesExpandidos, setMesesExpandidos] = useState<Set<string>>(new Set())

  function alternarMes(periodo: string) {
    setMesesExpandidos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(periodo)) siguiente.delete(periodo)
      else siguiente.add(periodo)
      return siguiente
    })
  }

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass p-4">
      <h3 className="font-display text-base font-semibold text-concreto-oscuro">Detalle por mes</h3>
      <p className="mt-0.5 font-body text-xs text-concreto">
        Clic en un mes para ver qué trenes y coches tienen discos a reperfilar o cambiar.
      </p>

      <ul className="mt-4 grid gap-2">
        {meses.map((mes) => {
          const expandido = mesesExpandidos.has(mes.periodo)
          const tieneCambio = mes.cambios > 0
          const esCritico = mes.criticos > 0 || mes.cambios >= 5
          return (
            <li key={mes.periodo} className="overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={() => alternarMes(mes.periodo)}
                className={`group flex w-full items-center justify-between gap-3 border-l-4 px-4 py-3 text-left transition-all ${
                  expandido
                    ? 'border-verde-institucional bg-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
                    : esCritico
                      ? 'border-red-400 bg-red-50/35 hover:bg-red-50/65'
                      : tieneCambio
                        ? 'border-amber-400 bg-amber-50/35 hover:bg-amber-50/65'
                        : 'border-emerald-400 bg-white/45 hover:bg-white/80'
                }`}
              >
                <span className="flex items-center gap-3 font-body text-sm font-medium text-concreto-oscuro">
                  {expandido ? (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-verde-claro text-verde-oscuro"><ChevronDown size={16} aria-hidden /></span>
                  ) : (
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${esCritico ? 'bg-red-100 text-red-700' : tieneCambio ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}><ChevronRight size={16} aria-hidden /></span>
                  )}
                  <span>
                    <span className="block text-base font-semibold">{mes.etiqueta}</span>
                    <span className="block text-[0.65rem] uppercase tracking-[0.1em] text-concreto">Plan operativo mensual</span>
                  </span>
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 font-body text-[0.68rem] font-bold text-amber-700"><span className="font-data">{mes.reperfilados}</span> reperfilar</span>
                  <span className={`rounded-full px-2.5 py-1 font-body text-[0.68rem] font-bold ${tieneCambio ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}><span className="font-data">{mes.cambios}</span> cambiar</span>
                  {mes.criticos > 0 && <span className="hidden rounded-full bg-red-600 px-2 py-1 font-data text-[0.68rem] font-bold text-white lg:inline">{mes.criticos} críticos</span>}
                </span>
              </button>
              {expandido && <div className="border-x border-b border-slate-200 bg-white/70"><DetalleMesContenido periodo={mes.periodo} /></div>}
            </li>
          )
        })}
      </ul>
    </GlassSurface>
  )
}
