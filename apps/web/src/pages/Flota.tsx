import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GlassSelect } from '../components/GlassSelect'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { ESTADO_META } from '../features/fleet/components/estadoVisual'
import { fabricanteDeTren, type FabricanteTren } from '../features/fleet/components/fabricante'
import { LeyendaAlertasDiscos } from '../features/fleet/components/LeyendaAlertasDiscos'
import { getEstadoDominanteTren } from '../features/fleet/components/semaforoTren'
import { TrainFrontCard } from '../features/fleet/components/TrainFrontCard'
import { useFleetSummary } from '../features/fleet/queries'
import type { EstadoDisco } from '../features/scan-records/types'

type FiltroFabricante = 'todos' | FabricanteTren

const FILTROS_FABRICANTE: { valor: FiltroFabricante; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'ALSTOM', etiqueta: 'Alstom' },
  { valor: 'ANSALDO', etiqueta: 'Ansaldo' },
]

const ORDEN_ESTADOS: EstadoDisco[] = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO']
const OPCIONES_ESTADO = ORDEN_ESTADOS.map((estado) => ({ valor: estado, etiqueta: ESTADO_META[estado].etiqueta }))

export function Flota() {
  const summary = useFleetSummary()
  const [busqueda, setBusqueda] = useState('')
  const [fabricante, setFabricante] = useState<FiltroFabricante>('todos')
  const [filtroEstado, setFiltroEstado] = useState<EstadoDisco | undefined>(undefined)

  // KPIs: respetan el toggle de fabricante (igual que EVA-Aldy), no la
  // búsqueda ni el filtro de estado — son el resumen estable de la flota,
  // no un conteo de lo que quedó visible tras filtrar el grid.
  const kpis = useMemo(() => {
    const conteo: Record<EstadoDisco, number> = { OK: 0, SEGUIMIENTO: 0, CAMBIO: 0, CRITICO: 0, REPERFILADO: 0 }
    let total = 0
    for (const tren of summary.data ?? []) {
      if (fabricante !== 'todos' && fabricanteDeTren(tren.tren) !== fabricante) continue
      total++
      conteo[getEstadoDominanteTren(tren.conteoEstado)]++
    }
    return { total, conteo }
  }, [summary.data, fabricante])

  const filtrados = useMemo(() => {
    const trimmed = busqueda.trim()
    return (summary.data ?? []).filter((tren) => {
      if (fabricante !== 'todos' && fabricanteDeTren(tren.tren) !== fabricante) return false
      if (trimmed && !String(tren.tren).includes(trimmed)) return false
      if (filtroEstado && getEstadoDominanteTren(tren.conteoEstado) !== filtroEstado) return false
      return true
    })
  }, [summary.data, busqueda, fabricante, filtroEstado])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
          <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Flota</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-concreto">Vista general de los trenes de la flota.</p>
        </div>
      </div>

      <div className="mb-4">
        <LeyendaAlertasDiscos />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <GlassSurface className="rounded-glass px-4 py-3">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-concreto">Total trenes</p>
          <p className="mt-1 font-display text-3xl font-bold text-concreto-oscuro">{kpis.total}</p>
        </GlassSurface>
        {ORDEN_ESTADOS.map((estado) => (
          <GlassSurface key={estado} className="rounded-glass px-4 py-3">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-concreto">{ESTADO_META[estado].etiqueta}</p>
            <p className="mt-1 font-display text-3xl font-bold" style={{ color: ESTADO_META[estado].cssVar }}>
              {kpis.conteo[estado]}
            </p>
          </GlassSurface>
        ))}
      </div>

      <GlassSurface fuerte className="mb-6 space-y-3 rounded-glass p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
              Buscar por número de tren
            </label>
            <div className="relative">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-concreto" />
              <input
                type="search"
                inputMode="numeric"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Número de tren…"
                aria-label="Buscar por número de tren"
                className="glass-field py-2.5 pl-9"
              />
            </div>
          </div>
          <SegmentedControl
            ariaLabel="Filtrar por fabricante"
            opciones={FILTROS_FABRICANTE}
            valor={fabricante}
            onCambiar={(v) => setFabricante(v)}
          />
        </div>

        <GlassSelect
          label="Estado del tren"
          opciones={OPCIONES_ESTADO}
          seleccion={filtroEstado}
          onCambiar={(v) => setFiltroEstado(v as EstadoDisco | undefined)}
          placeholder="Todos"
          className="max-w-xs"
        />
      </GlassSurface>

      {summary.isLoading && <p className="py-12 text-center font-body text-sm text-concreto">Cargando flota...</p>}
      {summary.isError && (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar el resumen de flota.
        </p>
      )}

      {summary.data && filtrados.length === 0 && (
        <p className="py-12 text-center font-body text-sm text-concreto">Sin coincidencias con los filtros actuales.</p>
      )}

      {filtrados.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((tren) => (
            <Link key={tren.tren} to={`/fleet/${tren.tren}`} className="group block">
              <TrainFrontCard tren={tren} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
