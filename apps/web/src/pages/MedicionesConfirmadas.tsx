import type { SortingState } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassField } from '../components/GlassField'
import { GlassSurface } from '../components/GlassSurface'
import { TarjetaDatosFaltantes } from '../features/fleet-completeness/components/TarjetaDatosFaltantes'
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
import type { AlcanceScanRecords, ColumnaOrdenable, PreviewParams, PreviewRow } from '../features/scan-records/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PAGE_SIZE = 25

// Alcance fijo: sin fileId, los hooks compartidos de scan-records/queries
// pegan a /scan-records (solo registros con disc_id resuelto) en vez de
// /migration/:fileId — ver features/scan-records/types#AlcanceScanRecords.
const ALCANCE_CONFIRMADOS: AlcanceScanRecords = {}

// Pseudo-tren "Reserva" (ver schema.prisma, Train.numero=0).
function etiquetaTrenSeleccionado(tren: number | null): string {
  if (tren === null) return 'Todos los trenes'
  if (tren === 0) return 'Reserva'
  return `Tren ${tren}`
}

// Vista permanente de mediciones YA confirmadas — disponible en cualquier
// momento (no solo justo tras subir un archivo), sin depender de ningún
// fileId. Misma UI que la vista previa de migración (MigracionPreview),
// armada sobre los mismos componentes/hooks compartidos de
// features/scan-records; acá NO hay botones de "Confirmar y guardar" ni
// "Cancelar migración masiva" (no tienen sentido fuera de una carga en
// curso) ni "eliminar tren completo" (sin endpoint de borrado masivo para
// datos ya confirmados) — editar/eliminar por fila sí, vía
// PATCH/DELETE /scan-records/:id.
export function MedicionesConfirmadas() {
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
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [filaAEliminar, setFilaAEliminar] = useState<PreviewRow | null>(null)

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

  const resumen = useScanRecordsResumenPorTren(ALCANCE_CONFIRMADOS)
  const opciones = useScanRecordsOpcionesFiltro(ALCANCE_CONFIRMADOS)
  const preview = useScanRecordsPreview(ALCANCE_CONFIRMADOS, params)
  const stats = useScanRecordsStats(ALCANCE_CONFIRMADOS, params)
  const eliminarFila = useEliminarScanRecordFila(ALCANCE_CONFIRMADOS)
  const editarFila = useEditarScanRecordFila(ALCANCE_CONFIRMADOS)

  const filtrosActivos = contarFiltrosActivos(filtros)
  const hayFiltro = trenSeleccionado !== null || busqueda !== '' || filtrosActivos > 0

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

  const totalPaginas = preview.data?.totalPaginas ?? preview.data?.totalPages ?? 1

  return (
    <div className="px-3 py-6 text-[0.8125rem] sm:px-5 [&_.text-2xl]:text-lg [&_.text-sm]:text-[0.6875rem] [&_.text-xs]:text-[0.5625rem]">
      <div className="mx-auto flex max-w-[112.5rem] items-start gap-5">
        <SidebarTrenes
          resumen={resumen.data ?? []}
          cargando={resumen.isLoading}
          trenSeleccionado={trenSeleccionado}
          onSeleccionar={(t) => {
            setTrenSeleccionado(t)
            setPage(1)
          }}
        />

        <main className="min-w-0 flex-1">
          {/* Barra glass: título — sin acciones de migración, no aplican acá */}
          <GlassSurface fuerte className="relative isolate flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-glass-lg bg-[linear-gradient(115deg,rgba(255,255,255,0.92),rgba(236,253,245,0.86),rgba(240,249,255,0.82))] px-6 py-5">
            <div aria-hidden className="absolute -right-20 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <img aria-hidden src="/images/cardcochealstom1.png" className="pointer-events-none absolute -right-14 bottom-0 hidden h-36 w-80 object-contain opacity-30 lg:block" />
            <div className="relative">
              <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.2em] text-emerald-700">Centro de datos · tiempo real</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
                Mediciones confirmadas
              </h1>
              <p className="mt-0.5 font-body text-sm text-concreto">
                {etiquetaTrenSeleccionado(trenSeleccionado)} ·{' '}
                <span className="font-data">{preview.data?.total ?? 0}</span> registros
              </p>
            </div>
          </GlassSurface>

          <SemaforoMediciones stats={stats.data} />

          {/* Estado de la flota física completa (ver TarjetaUltimaMedicion) —
              reusa trenSeleccionado como el toggle General/Por tren. */}
          <div className="mt-4 space-y-3">
            <TarjetaDatosFaltantes />
            <TarjetaUltimaMedicion trenSeleccionado={trenSeleccionado} />
            <TarjetaBrechaFechas />
          </div>

          {/* Panel de estados arriba de la tabla en pantallas sin columna derecha */}
          <div className="mt-4 xl:hidden">
            <PanelEstados stats={stats.data} hayFiltro={hayFiltro} etiquetaTotal="mediciones confirmadas" />
          </div>

          {/* Buscador + toggle de filtros */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[15rem] flex-1">
              <GlassField
                label="Buscar en las mediciones"
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
                alcance={ALCANCE_CONFIRMADOS}
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
              compacta
              sinScrollInterno
              scrollHorizontal
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
            <PanelEstados stats={stats.data} hayFiltro={hayFiltro} etiquetaTotal="mediciones confirmadas" />
          </div>
        </aside>
      </div>

      {filaEditando && (
        <ModalEditarFila
          fila={filaEditando}
          mostrarTren={false}
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

      {filaAEliminar && (
        <ConfirmDialog
          titulo="Eliminar medición"
          variante="danger"
          textoConfirmar="Sí, eliminar"
          onConfirm={confirmarEliminarFila}
          onCerrar={() => setFilaAEliminar(null)}
          mensaje={`¿Eliminar esta medición del tren ${filaAEliminar.trenNumero}? Esta acción no se puede deshacer.`}
        />
      )}
    </div>
  )
}

function SemaforoMediciones({ stats }: { stats?: { total: { ok: number; seguimiento: number; cambio: number; critico: number; reperfilado: number } } }) {
  const estados = [
    ['Reperfilado', stats?.total.reperfilado ?? 0, 'bg-fuchsia-500', 'text-fuchsia-700', 'from-fuchsia-50 to-white'],
    ['Crítico', stats?.total.critico ?? 0, 'bg-red-500', 'text-red-700', 'from-red-50 to-white'],
    ['Cambio', stats?.total.cambio ?? 0, 'bg-amber-500', 'text-amber-700', 'from-amber-50 to-white'],
    ['OK', stats?.total.ok ?? 0, 'bg-emerald-500', 'text-emerald-700', 'from-emerald-50 to-white'],
  ] as const
  const total = estados.reduce((suma, [, valor]) => suma + valor, 0) || 1

  return (
    <GlassSurface fuerte className="mt-3 rounded-glass p-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-concreto">Semáforo operativo</span>
        <span className="text-xs text-concreto">Pasa el cursor para revisar la distribución</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {estados.map(([label, value, dot, text, fondo]) => (
          <div key={label} title={`${label}: ${value} mediciones`} className={`group rounded-xl border border-white/80 bg-gradient-to-br ${fondo} p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md`}>
            <div className="flex items-center justify-between gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot} shadow-[0_0_0_4px_rgba(255,255,255,0.58)]`} /><span className={`font-data text-sm font-bold ${text}`}>{Math.round((value / total) * 100)}%</span></div>
            <p className="mt-2 font-body text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-concreto">{label}</p>
            <p className={`mt-0.5 font-data text-xl font-bold ${text}`}>{value}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/60"><span className={`block h-full rounded-full ${dot} transition-all duration-700`} style={{ width: `${(value / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
