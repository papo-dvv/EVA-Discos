import { useMemo, useState } from 'react'
import { PackagePlus, Undo2 } from 'lucide-react'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { GlassField } from '../components/GlassField'
import { GlassSelect } from '../components/GlassSelect'
import { SegmentedControl } from '../components/SegmentedControl'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModalEditarEje } from '../features/inventory/components/ModalEditarEje'
import { ModalRegistrarDisco } from '../features/inventory/components/ModalRegistrarDisco'
import { ModalVerDetalleEje } from '../features/inventory/components/ModalVerDetalleEje'
import { TablaInventario } from '../features/inventory/components/TablaInventario'
import { useDevolverAlmacen, useEliminarEje, useInventario, useStatsInventario } from '../features/inventory/queries'
import { ETIQUETA_STAGE, FASES_DISCO, INVENTORY_STAGES, type FaseDisco, type InventoryRow, type InventoryStage } from '../features/inventory/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const FILTROS_STAGE = INVENTORY_STAGES.map((s) => ({ valor: s, etiqueta: ETIQUETA_STAGE[s] }))
const OPCIONES_FASE = FASES_DISCO.map((f) => ({ valor: f, etiqueta: f === 'nueva' ? 'Nueva' : 'Usada' }))
const OPCIONES_ESTADO = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO'].map((e) => ({ valor: e, etiqueta: e }))

const BANNER_STAGE: Record<InventoryStage, string> = {
  taller: 'Ejes en Taller: sueltos tras un retiro o un cambio, todavía sin volver a Almacén.',
  en_servicio: 'Ruedas instaladas en trenes activos. El reperfilado se registra en Operaciones → Reperfilado; el botón Editar corrige datos del componente (serie, fabricante, etc.).',
  almacen: 'Ruedas en Almacén. El retiro se hace desde Operaciones → Retiro masivo.',
}

export function Inventario() {
  const [stage, setStage] = useState<InventoryStage>('taller')
  const [search, setSearch] = useState('')
  const [fase, setFase] = useState<FaseDisco | undefined>(undefined)
  const [estado, setEstado] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [ejeDetalle, setEjeDetalle] = useState<InventoryRow | null>(null)
  const [ejeEditando, setEjeEditando] = useState<InventoryRow | null>(null)
  const [ejeAEliminar, setEjeAEliminar] = useState<InventoryRow | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [devolviendo, setDevolviendo] = useState(false)
  const [encargadoDevolucion, setEncargadoDevolucion] = useState('')
  const [errorDevolucion, setErrorDevolucion] = useState<string | null>(null)

  const stats = useStatsInventario()
  const inventario = useInventario({
    page,
    pageSize: 25,
    stage: [stage],
    fase: fase ? [fase] : undefined,
    search: search.trim() || undefined,
  })
  const eliminarEje = useEliminarEje()
  const devolverAlmacen = useDevolverAlmacen()

  // Estado (OK/Seguimiento/Cambio/Crítico/Reperfilado) no es un campo propio
  // de BrakeDisc (se deriva de la última medición de cada lado) — filtrarlo
  // en el backend requeriría un join extra en el WHERE; se filtra acá sobre
  // la página ya traída. Con eso, una página filtrada puede mostrar menos de
  // 25 filas aunque haya más en páginas siguientes — trade-off aceptado por
  // simplicidad hasta que haga falta paginar del lado del servidor.
  const filasFiltradas = useMemo(() => {
    if (!estado) return inventario.data?.rows ?? []
    return (inventario.data?.rows ?? []).filter(
      (r) => r.izquierdo?.estadoCalculado === estado || r.derecho?.estadoCalculado === estado,
    )
  }, [inventario.data?.rows, estado])

  function cambiarStage(nuevo: InventoryStage) {
    setStage(nuevo)
    setPage(1)
    setSeleccion(new Set())
  }

  async function confirmarEliminar() {
    if (!ejeAEliminar?.serie) return
    await eliminarEje.mutateAsync(ejeAEliminar.serie)
    setEjeAEliminar(null)
  }

  function alternarSeleccion(serie: string) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(serie)) nuevo.delete(serie)
      else nuevo.add(serie)
      return nuevo
    })
  }

  async function confirmarDevolucion() {
    setErrorDevolucion(null)
    const discIds = (inventario.data?.rows ?? [])
      .filter((r) => r.serie && seleccion.has(r.serie))
      .flatMap((r) => [r.izquierdo?.discoId, r.derecho?.discoId])
      .filter((id): id is string => Boolean(id))
    try {
      await devolverAlmacen.mutateAsync({ discIds, encargadoNombre: encargadoDevolucion.trim() })
      setDevolviendo(false)
      setEncargadoDevolucion('')
      setSeleccion(new Set())
    } catch (err) {
      setErrorDevolucion(extraerMensajeError(err, 'No se pudo completar la devolución a almacén.'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
          <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Inventario</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-concreto">Ejes de disco de freno por etapa.</p>
        </div>
        {stage !== 'en_servicio' && (
          <GlassButton type="button" onClick={() => setModalAbierto(true)}>
            <PackagePlus size={16} aria-hidden />
            Nueva rueda
          </GlassButton>
        )}
      </div>

      <div className="mb-4">
        <SegmentedControl ariaLabel="Filtrar por etapa" opciones={FILTROS_STAGE} valor={stage} onCambiar={cambiarStage} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {INVENTORY_STAGES.map((s) => (
          <GlassSurface key={s} className="rounded-glass px-4 py-3">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">{ETIQUETA_STAGE[s]}</p>
            <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">{stats.data ? stats.data[s] : '—'}</p>
          </GlassSurface>
        ))}
      </div>

      <GlassSurface fuerte className="mb-4 rounded-glass p-4">
        <p className="font-body text-sm text-concreto-oscuro">{BANNER_STAGE[stage]}</p>
      </GlassSurface>

      <GlassSurface fuerte className="mb-4 flex flex-wrap items-end gap-3 rounded-glass p-4">
        <div className="min-w-[14rem] flex-1">
          <GlassField
            label="Buscar serie"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Serie, marca, lote…"
          />
        </div>
        <GlassSelect
          label="Fase"
          opciones={OPCIONES_FASE}
          seleccion={fase}
          onCambiar={(v) => {
            setFase(v as FaseDisco | undefined)
            setPage(1)
          }}
          className="w-40"
        />
        <GlassSelect
          label="Estado"
          opciones={OPCIONES_ESTADO}
          seleccion={estado}
          onCambiar={setEstado}
          className="w-44"
        />
        {stage === 'taller' && seleccion.size > 0 && (
          <GlassButton type="button" variante="secundario" onClick={() => setDevolviendo(true)}>
            <Undo2 size={16} aria-hidden />
            Devolver a almacén ({seleccion.size})
          </GlassButton>
        )}
      </GlassSurface>

      <GlassSurface fuerte className="overflow-hidden rounded-glass-lg">
        <TablaInventario
          stage={stage}
          rows={filasFiltradas}
          cargando={inventario.isLoading}
          seleccionables={stage === 'taller'}
          seleccionados={seleccion}
          onToggleSeleccion={alternarSeleccion}
          onVerDetalle={setEjeDetalle}
          onEditar={setEjeEditando}
          onEliminar={setEjeAEliminar}
        />
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
      {ejeDetalle && <ModalVerDetalleEje eje={ejeDetalle} onCerrar={() => setEjeDetalle(null)} />}
      {ejeEditando && <ModalEditarEje eje={ejeEditando} onCerrar={() => setEjeEditando(null)} />}

      {ejeAEliminar && (
        <ConfirmDialog
          titulo="Eliminar eje"
          variante="danger"
          textoConfirmar="Sí, eliminar"
          onConfirm={confirmarEliminar}
          onCerrar={() => setEjeAEliminar(null)}
          mensaje={`¿Eliminar el eje ${ejeAEliminar.serie ?? ''}? Esta acción no se puede deshacer.`}
        />
      )}

      {devolviendo && (
        <ConfirmDialog
          titulo="Devolver a almacén"
          textoConfirmar="Confirmar"
          onConfirm={confirmarDevolucion}
          onCerrar={() => setDevolviendo(false)}
          motivoConfirmarDeshabilitado={encargadoDevolucion.trim() ? null : 'Ingresá el nombre del encargado.'}
          mensaje={
            <div className="space-y-3 text-left">
              <p>¿Devolver {seleccion.size} eje(s) seleccionados a Almacén?</p>
              <GlassField
                label="Encargado *"
                value={encargadoDevolucion}
                onChange={(e) => setEncargadoDevolucion(e.target.value)}
                placeholder="Nombre del encargado"
              />
              {errorDevolucion && (
                <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
                  ⚠ {errorDevolucion}
                </p>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}
