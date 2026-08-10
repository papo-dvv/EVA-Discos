import type { SortingState } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassField } from '../components/GlassField'
import { GlassSurface } from '../components/GlassSurface'
import { PantallaFondo } from '../components/PantallaFondo'
import { TarjetaDatosFaltantes } from '../features/fleet-completeness/components/TarjetaDatosFaltantes'
import { useCancelarMigracion, useConfirmarMigracion, useEliminarTren } from '../features/migration/queries'
import { TarjetaBrechaFechas } from '../features/measurement-gap/components/TarjetaBrechaFechas'
import { ModalEditarFila } from '../features/scan-records/components/ModalEditarFila'
import { PaginacionNumerica } from '../features/scan-records/components/PaginacionNumerica'
import { PanelEstados } from '../features/scan-records/components/PanelEstados'
import { PanelFiltros } from '../features/scan-records/components/PanelFiltros'
import { SidebarTrenes } from '../features/scan-records/components/SidebarTrenes'
import { TablaScanRecords } from '../features/scan-records/components/TablaScanRecords'
import { TarjetaUltimaMedicion } from '../features/scan-records/components/TarjetaUltimaMedicion'
import {
  FILTROS_VACIOS,
  aplicarFiltros,
  contarFiltrosActivos,
  type FiltrosState,
} from '../features/scan-records/filtros'
import {
  useEditarScanRecordFila,
  useEliminarScanRecordFila,
  useScanRecordsOpcionesFiltro,
  useScanRecordsPreview,
  useScanRecordsResumenPorTren,
  useScanRecordsStats,
} from '../features/scan-records/queries'
import type {
  AlcanceScanRecords,
  ColumnaOrdenable,
  PreviewParams,
  PreviewRow,
  ResumenTren,
} from '../features/scan-records/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PAGE_SIZE = 25

// Vista previa de una migración EN CURSO (borrador, disc_id todavía null):
// misma UI que /mediciones (vista permanente de confirmados), armada sobre
// los componentes/hooks compartidos de features/scan-records — acá el único
// código propio son las acciones exclusivas de este modo (confirmar el
// commit, cancelar/eliminar-tren de la carga).
export function MigracionPreview() {
  const { fileId = '' } = useParams<{ fileId: string }>()
  const navigate = useNavigate()
  const alcance: AlcanceScanRecords = { fileId }

  const [trenSeleccionado, setTrenSeleccionado] = useState<number | null>(null)
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  // Vacío = sin sortBy/sortDir explícito: la carga inicial deja que el
  // backend aplique su orden físico jerárquico por defecto (tren→coche→
  // bogie→eje→lado). Solo se puebla tras un click explícito en un
  // encabezado ordenable de TablaScanRecords.
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)
  const [filaEditando, setFilaEditando] = useState<PreviewRow | null>(null)
  const [confirmada, setConfirmada] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [confirmandoCommit, setConfirmandoCommit] = useState(false)
  const [filaAEliminar, setFilaAEliminar] = useState<PreviewRow | null>(null)
  const [trenAEliminar, setTrenAEliminar] = useState<ResumenTren | null>(null)

  // Debounce de la búsqueda para no disparar una request por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(busquedaInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const params: PreviewParams = useMemo(() => {
    const orden = sorting[0]
    const base: PreviewParams = {
      tren: trenSeleccionado ?? undefined,
      page,
      pageSize: PAGE_SIZE,
      search: busqueda || undefined,
      ...(orden
        ? { sortBy: orden.id as ColumnaOrdenable, sortDir: orden.desc ? 'desc' : 'asc' }
        : {}),
    }
    return aplicarFiltros(base, filtros)
  }, [trenSeleccionado, page, busqueda, sorting, filtros])

  const resumen = useScanRecordsResumenPorTren(alcance)
  const opciones = useScanRecordsOpcionesFiltro(alcance)
  const preview = useScanRecordsPreview(alcance, params)
  const stats = useScanRecordsStats(alcance, params)
  const eliminarTren = useEliminarTren(fileId)
  const eliminarFila = useEliminarScanRecordFila(alcance)
  const editarFila = useEditarScanRecordFila(alcance)
  const confirmar = useConfirmarMigracion(fileId)
  const cancelar = useCancelarMigracion(fileId)

  const filtrosActivos = contarFiltrosActivos(filtros)
  const hayFiltro = trenSeleccionado !== null || busqueda !== '' || filtrosActivos > 0

  // Cambiar cualquier filtro vuelve a la página 1 (el total cambia).
  function cambiarFiltros(patch: Partial<FiltrosState>) {
    setFiltros((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS)
    setPage(1)
  }

  async function confirmarEliminarFila() {
    if (!filaAEliminar) return
    await eliminarFila.mutateAsync(filaAEliminar.id)
  }

  async function confirmarEliminarTren() {
    if (!trenAEliminar) return
    await eliminarTren.mutateAsync(trenAEliminar.tren)
    if (trenSeleccionado === trenAEliminar.tren) setTrenSeleccionado(null)
  }

  // Al confirmar TODOS los lotes del commit, la carga ya no es un borrador:
  // se navega a la vista permanente de confirmados en vez de quedarse acá.
  async function confirmarCommit() {
    await confirmar.mutateAsync()
    setConfirmada(true)
    navigate('/mediciones', { replace: true })
  }

  async function confirmarCancelacion() {
    // No cierra el modal al fallar: ConfirmDialog muestra el error ahí mismo
    // y solo cierra cuando onConfirm resuelve. Solo navega al éxito.
    await cancelar.mutateAsync()
    navigate('/migracion', { replace: true })
  }

  const totalPaginas = preview.data?.totalPaginas ?? preview.data?.totalPages ?? 1
  // Total real de la carga (sin filtro) para el modal de cancelación.
  const totalFilasCarga = stats.data?.totalFilasSubidas ?? preview.data?.total ?? 0

  return (
    <PantallaFondo className="px-3 py-6 sm:px-5">
      <div className="mx-auto flex max-w-[112.5rem] items-start gap-5">
        <SidebarTrenes
          resumen={resumen.data ?? []}
          cargando={resumen.isLoading}
          trenSeleccionado={trenSeleccionado}
          onSeleccionar={(t) => {
            setTrenSeleccionado(t)
            setPage(1)
          }}
          onEliminarTren={setTrenAEliminar}
          deshabilitado={confirmada}
        />

        <main className="min-w-0 flex-1">
          {/* Barra glass: título + acción de confirmar */}
          <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
                Vista previa de migración
              </h1>
              <p className="mt-0.5 font-body text-sm text-concreto">
                {trenSeleccionado ? `Tren ${trenSeleccionado}` : 'Todos los trenes'} ·{' '}
                <span className="font-data">{preview.data?.total ?? 0}</span> filas
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!confirmada && (
                <GlassButton
                  type="button"
                  variante="secundario"
                  onClick={() => setCancelando(true)}
                  disabled={cancelar.isPending}
                  style={{ borderColor: 'var(--color-estado-critico)', color: 'var(--color-estado-critico)' }}
                >
                  Cancelar migración masiva
                </GlassButton>
              )}
              <GlassButton
                type="button"
                onClick={() => setConfirmandoCommit(true)}
                disabled={confirmada || confirmar.isPending}
                cargando={confirmar.isPending}
              >
                {confirmada ? 'Migración confirmada ✓' : 'Confirmar y guardar en base de datos'}
              </GlassButton>
            </div>
          </GlassSurface>

          {confirmada && (
            <p role="status" className="mt-3 font-body text-sm text-verde-oscuro">
              La carga quedó confirmada (status «committed»): se resolvieron los coches y discos, y los
              registros pasaron a definitivos.
            </p>
          )}

          {/* Estado de la flota física completa — siempre contra el
              histórico YA CONFIRMADO (ver TarjetaUltimaMedicion), nunca
              contra este borrador en curso. Reusa trenSeleccionado como el
              toggle General/Por tren. */}
          <div className="mt-4 space-y-3">
            <TarjetaDatosFaltantes />
            <TarjetaUltimaMedicion trenSeleccionado={trenSeleccionado} />
            <TarjetaBrechaFechas />
          </div>

          {/* Panel de estados arriba de la tabla en pantallas sin columna derecha */}
          <div className="mt-4 xl:hidden">
            <PanelEstados stats={stats.data} hayFiltro={hayFiltro} />
          </div>

          {/* Buscador + toggle de filtros */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[15rem] flex-1">
              <GlassField
                label="Buscar en la carga"
                type="search"
                placeholder="Responsable, motivo, coche, bogie, ubicación…"
                value={busquedaInput}
                onChange={(e) => setBusquedaInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((a) => !a)}
              className="flex items-center gap-2 rounded-full border border-concreto/30 bg-white/55 px-4 py-2.5 font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/70"
            >
              <span>Filtros</span>
              {filtrosActivos > 0 && (
                <span className="rounded-full bg-verde-claro px-2 py-0.5 font-data text-xs text-verde-oscuro">
                  {filtrosActivos}
                </span>
              )}
              <span className="text-concreto">{filtrosAbiertos ? '▲' : '▼'}</span>
            </button>
          </div>

          {filtrosAbiertos && (
            <GlassSurface fuerte className="mt-3 rounded-glass p-5">
              <PanelFiltros
                filtros={filtros}
                onCambiar={cambiarFiltros}
                onLimpiar={limpiarFiltros}
                opciones={opciones.data}
                disabled={confirmada}
                alcance={alcance}
              />
            </GlassSurface>
          )}

          {/* Tabla (§6.1 híbrido sutil) */}
          {preview.isLoading ? (
            <p className="mt-6 font-body text-sm text-concreto">Cargando…</p>
          ) : preview.isError ? (
            <p role="alert" className="mt-6 font-body text-sm text-[color:var(--color-estado-critico)]">
              {extraerMensajeError(preview.error)}
            </p>
          ) : (
            <TablaScanRecords
              rows={preview.data?.rows ?? []}
              sorting={sorting}
              onSortingChange={setSorting}
              mostrarColumnaTren={trenSeleccionado === null}
              onEditar={setFilaEditando}
              onEliminar={setFilaAEliminar}
              accionesDeshabilitadas={confirmada}
            />
          )}

          {/* Paginación numérica */}
          <div className="mt-4">
            <PaginacionNumerica page={page} totalPaginas={totalPaginas} onPage={setPage} />
          </div>
        </main>

        {/* Columna derecha: panel de estados + parámetros (desde xl) */}
        <aside className="hidden w-[21.25rem] flex-shrink-0 xl:block">
          <div className="sticky top-6">
            <PanelEstados stats={stats.data} hayFiltro={hayFiltro} />
          </div>
        </aside>
      </div>

      {filaEditando && (
        <ModalEditarFila
          fila={filaEditando}
          mostrarTren
          guardando={editarFila.isPending}
          error={editarFila.error}
          onGuardar={(cambios) =>
            editarFila.mutate(
              { rowId: filaEditando.id, cambios },
              { onSuccess: () => setFilaEditando(null) },
            )
          }
          onCerrar={() => setFilaEditando(null)}
        />
      )}

      {cancelando && (
        <ConfirmDialog
          titulo="Cancelar migración masiva"
          variante="danger"
          textoConfirmar="Sí, cancelar migración"
          textoCancelar="Volver"
          onConfirm={confirmarCancelacion}
          onCerrar={() => setCancelando(false)}
          mensaje={
            <>
              Esto eliminará las <b className="font-data">{totalFilasCarga}</b> filas de esta carga.
              Esta acción <b>no se puede deshacer</b>.
            </>
          }
        />
      )}

      {filaAEliminar && (
        <ConfirmDialog
          titulo="Eliminar fila"
          variante="danger"
          textoConfirmar="Sí, eliminar"
          onConfirm={confirmarEliminarFila}
          onCerrar={() => setFilaAEliminar(null)}
          mensaje={`¿Eliminar la fila del tren ${filaAEliminar.trenNumero} (${filaAEliminar.hojaExcelOrigen})?`}
        />
      )}

      {trenAEliminar && (
        <ConfirmDialog
          titulo="Eliminar tren completo"
          variante="danger"
          textoConfirmar="Sí, eliminar todas"
          onConfirm={confirmarEliminarTren}
          onCerrar={() => setTrenAEliminar(null)}
          mensaje={
            <>
              ¿Eliminar TODAS las <b className="font-data">{trenAEliminar.totalFilas}</b> filas del tren{' '}
              <b className="font-data">{trenAEliminar.tren}</b>? Esta acción <b>no se puede deshacer</b>.
            </>
          }
        />
      )}

      {confirmandoCommit && (
        <ConfirmDialog
          titulo="Confirmar migración"
          textoConfirmar="Sí, confirmar"
          onConfirm={confirmarCommit}
          onCerrar={() => setConfirmandoCommit(false)}
          mensaje="¿Confirmar y guardar la migración en base de datos? Después no podrás seguir editando este borrador."
        />
      )}
    </PantallaFondo>
  )
}
