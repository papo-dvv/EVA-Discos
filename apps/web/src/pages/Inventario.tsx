import { useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { ModalRegistrarDisco } from '../features/inventory/components/ModalRegistrarDisco'
import { TablaInventario } from '../features/inventory/components/TablaInventario'
import { useInventario, useStatsInventario } from '../features/inventory/queries'
import { ETIQUETA_STAGE, type InventoryStage } from '../features/inventory/types'

const FILTROS_STAGE: { valor: InventoryStage | 'todos'; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'almacen', etiqueta: ETIQUETA_STAGE.almacen },
  { valor: 'taller', etiqueta: ETIQUETA_STAGE.taller },
  { valor: 'en_servicio', etiqueta: ETIQUETA_STAGE.en_servicio },
]

export function Inventario() {
  const [stage, setStage] = useState<InventoryStage | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalAbierto, setModalAbierto] = useState(false)
  const stats = useStatsInventario()
  const inventario = useInventario({
    page,
    pageSize: 25,
    stage: stage === 'todos' ? undefined : [stage],
    search: search.trim() || undefined,
  })

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
          <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Inventario</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-concreto">
            Piezas de disco de freno por etapa: Almacén, Taller y En servicio.
          </p>
        </div>
        <GlassButton type="button" onClick={() => setModalAbierto(true)}>
          <PackagePlus size={16} aria-hidden />
          Agregar disco
        </GlassButton>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['almacen', 'taller', 'en_servicio'] as const).map((s) => (
          <GlassSurface key={s} className="rounded-glass px-4 py-3">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">
              {ETIQUETA_STAGE[s]}
            </p>
            <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">
              {stats.data ? stats.data[s] : '—'}
            </p>
          </GlassSurface>
        ))}
      </div>

      <GlassSurface fuerte className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4">
        <SegmentedControl
          ariaLabel="Filtrar por etapa"
          opciones={FILTROS_STAGE}
          valor={stage}
          onCambiar={(v) => {
            setStage(v)
            setPage(1)
          }}
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por serie, marca o fabricante…"
          className="glass-field w-full max-w-xs px-3 py-2 text-sm"
        />
      </GlassSurface>

      <GlassSurface fuerte className="overflow-hidden rounded-glass-lg">
        <TablaInventario rows={inventario.data?.rows ?? []} cargando={inventario.isLoading} />
      </GlassSurface>

      {inventario.data && inventario.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <GlassButton
            type="button"
            variante="secundario"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-xs"
          >
            Anterior
          </GlassButton>
          <span className="font-body text-sm text-concreto">
            Página {inventario.data.page} de {inventario.data.totalPages}
          </span>
          <GlassButton
            type="button"
            variante="secundario"
            disabled={page >= inventario.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-xs"
          >
            Siguiente
          </GlassButton>
        </div>
      )}

      {modalAbierto && <ModalRegistrarDisco onCerrar={() => setModalAbierto(false)} />}
    </div>
  )
}
