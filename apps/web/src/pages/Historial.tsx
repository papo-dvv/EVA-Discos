import { Disc3, History, Info, Ruler, Sparkles, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GlassModal } from '../components/GlassModal'
import { GlassSurface } from '../components/GlassSurface'
import { WarningTooltip } from '../components/WarningTooltip'
import { useHistorial, useKpisHistorial } from '../features/historial/queries'
import type { EventoHistorial, FiltrosHistorial, TipoEventoHistorial } from '../features/historial/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const TIPOS: { valor: TipoEventoHistorial; etiqueta: string; icono: typeof Disc3 }[] = [
  { valor: 'CAMBIO_DISCO', etiqueta: 'Cambio de disco', icono: Disc3 },
  { valor: 'MEDICION', etiqueta: 'Medición', icono: Ruler },
  { valor: 'REPERFILADO', etiqueta: 'Reperfilado', icono: Wrench },
]

const COLOR_TIPO: Record<TipoEventoHistorial, string> = {
  CAMBIO_DISCO: 'var(--color-estado-cambio)',
  MEDICION: 'var(--color-verde-institucional)',
  REPERFILADO: 'var(--color-estado-seguimiento, #b8860b)',
}

// Página dedicada de Historial — feed unificado de cambios de disco reales,
// mediciones y reperfilados confirmados (ver apps/api/src/historial), NO una
// tabla de eventos propia: agrega InventoryMovement + MeasurementHistoryEvent
// ya existentes. Mismo patrón de composición (hero + KPIs + filtros + lista +
// modal de detalle) que el resto de páginas de EVA — ver styles.md.
export function Historial() {
  const [tiposActivos, setTiposActivos] = useState<Set<TipoEventoHistorial>>(() => new Set())
  const [tren, setTren] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoHistorial | null>(null)

  const trenNumero = tren.trim() !== '' && Number.isInteger(Number(tren)) ? Number(tren) : undefined

  const filtrosKpis = useMemo(
    () => ({ desde: desde || undefined, hasta: hasta || undefined, tren: trenNumero }),
    [desde, hasta, trenNumero],
  )
  const filtrosLista: FiltrosHistorial = useMemo(
    () => ({
      ...filtrosKpis,
      tipo: tiposActivos.size ? [...tiposActivos] : undefined,
      limit: 200,
    }),
    [filtrosKpis, tiposActivos],
  )

  const kpis = useKpisHistorial(filtrosKpis)
  const historial = useHistorial(filtrosLista)

  function alternarTipo(tipo: TipoEventoHistorial) {
    setTiposActivos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(tipo)) siguiente.delete(tipo)
      else siguiente.add(tipo)
      return siguiente
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <GlassSurface fuerte className="mb-4 rounded-glass p-5">
        <p className="mb-1 flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-verde-oscuro">
          <Sparkles size={13} aria-hidden /> Actividad de la flota
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
          <History size={22} aria-hidden /> Historial
        </h1>
        <p className="mt-1 font-body text-sm text-concreto">
          Cambios de disco reales, mediciones y reperfilados confirmados — fleet-wide.
        </p>
      </GlassSurface>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardKpi etiqueta="Total" valor={kpis.data?.total} />
        <CardKpi etiqueta="Última semana" valor={kpis.data?.ultimaSemana} />
        <CardKpi etiqueta="Trenes afectados" valor={kpis.data?.trenesAfectados} />
        <CardKpi etiqueta="Tipos diferentes" valor={kpis.data?.tiposDiferentes} />
      </div>

      <GlassSurface className="mb-4 flex flex-wrap items-end gap-3 rounded-glass p-4">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map(({ valor, etiqueta, icono: Icono }) => {
            const activo = tiposActivos.has(valor)
            return (
              <button
                key={valor}
                type="button"
                onClick={() => alternarTipo(valor)}
                aria-pressed={activo}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-xs font-semibold transition-colors"
                style={{
                  borderColor: activo ? COLOR_TIPO[valor] : 'rgba(140,137,127,0.25)',
                  background: activo ? `color-mix(in srgb, ${COLOR_TIPO[valor]} 14%, transparent)` : 'transparent',
                  color: activo ? 'var(--color-concreto-oscuro)' : 'var(--color-gris-concreto)',
                }}
              >
                <Icono size={13} aria-hidden />
                {etiqueta}
              </button>
            )
          })}
        </div>
        <label className="flex flex-col gap-1 font-body text-xs text-concreto">
          Tren
          <input
            type="number"
            min={1}
            value={tren}
            onChange={(e) => setTren(e.target.value)}
            placeholder="Todos"
            className="w-24 rounded-lg border border-black/[0.1] bg-white/60 px-2 py-1.5 font-data text-sm text-concreto-oscuro"
          />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-concreto">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-black/[0.1] bg-white/60 px-2 py-1.5 font-data text-sm text-concreto-oscuro"
          />
        </label>
        <label className="flex flex-col gap-1 font-body text-xs text-concreto">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-black/[0.1] bg-white/60 px-2 py-1.5 font-data text-sm text-concreto-oscuro"
          />
        </label>
      </GlassSurface>

      {historial.isLoading ? (
        <p className="py-12 text-center font-body text-sm text-concreto">Cargando…</p>
      ) : historial.isError ? (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(historial.error)}
        </p>
      ) : (historial.data?.length ?? 0) === 0 ? (
        <p className="py-12 text-center font-body text-sm text-concreto">Sin eventos para los filtros aplicados.</p>
      ) : (
        <div className="grid gap-2">
          {(historial.data ?? []).map((evento, i) => (
            <button
              key={`${evento.tipo}-${evento.fecha}-${i}`}
              type="button"
              onClick={() => setEventoSeleccionado(evento)}
              className="text-left"
            >
              <GlassSurface className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-transform hover:translate-x-0.5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: COLOR_TIPO[evento.tipo] }}
                    aria-hidden
                  />
                  <div className="overflow-hidden">
                    <p className="truncate font-body text-sm font-semibold text-concreto-oscuro">{evento.descripcion}</p>
                    <p className="font-body text-xs text-concreto">
                      {evento.trenNumero !== null ? `Tren ${evento.trenNumero}` : 'Sin tren'}
                    </p>
                  </div>
                </div>
                <time className="shrink-0 font-data text-xs text-concreto">{FORMATO_FECHA.format(new Date(evento.fecha))}</time>
              </GlassSurface>
            </button>
          ))}
        </div>
      )}

      {eventoSeleccionado && (
        <GlassModal titulo="Detalle del evento" onCerrar={() => setEventoSeleccionado(null)} ancho={420}>
          <dl className="grid gap-2 font-body text-sm">
            <Detalle etiqueta="Tipo" valor={TIPOS.find((t) => t.valor === eventoSeleccionado.tipo)?.etiqueta ?? eventoSeleccionado.tipo} />
            <Detalle etiqueta="Fecha" valor={FORMATO_FECHA.format(new Date(eventoSeleccionado.fecha))} />
            <Detalle etiqueta="Tren" valor={eventoSeleccionado.trenNumero !== null ? String(eventoSeleccionado.trenNumero) : '—'} />
            <Detalle etiqueta="Coche" valor={eventoSeleccionado.cocheNumero !== null ? String(eventoSeleccionado.cocheNumero) : '—'} />
            <Detalle etiqueta="Bogie" valor={eventoSeleccionado.bogieCodigo ?? '—'} />
            <Detalle etiqueta="Eje" valor={eventoSeleccionado.ejeNumero !== null ? String(eventoSeleccionado.ejeNumero) : '—'} />
            <Detalle etiqueta="Descripción" valor={eventoSeleccionado.descripcion} />
          </dl>
        </GlassModal>
      )}
    </div>
  )
}

function CardKpi({ etiqueta, valor }: { etiqueta: string; valor: number | undefined }) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <div className="mb-1 flex items-center gap-1 font-body text-xs font-semibold uppercase tracking-wide text-concreto">
        {etiqueta}
        <WarningTooltip texto={`${etiqueta} de eventos, según los filtros de tren/fecha aplicados (sin el filtro de tipo).`}>
          <Info size={12} className="text-concreto" aria-label="Más información" />
        </WarningTooltip>
      </div>
      <strong className="block font-data text-2xl text-concreto-oscuro">{valor ?? '—'}</strong>
    </GlassSurface>
  )
}

function Detalle({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.06] pb-1.5">
      <dt className="font-semibold text-concreto">{etiqueta}</dt>
      <dd className="text-right text-concreto-oscuro">{valor}</dd>
    </div>
  )
}
