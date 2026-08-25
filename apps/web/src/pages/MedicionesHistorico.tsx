import type { SortingState } from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassSurface } from '../components/GlassSurface'
import { ModalEditarFila } from '../features/scan-records/components/ModalEditarFila'
import { PaginacionNumerica } from '../features/scan-records/components/PaginacionNumerica'
import { TablaScanRecords } from '../features/scan-records/components/TablaScanRecords'
import {
  useEditarScanRecordFila,
  useEliminarScanRecordFila,
  useScanRecordsPreview,
} from '../features/scan-records/queries'
import type { AlcanceScanRecords, PreviewParams, PreviewRow } from '../features/scan-records/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PAGE_SIZE = 25
const ALCANCE_CONFIRMADOS: AlcanceScanRecords = {}

// Historial de mediciones de UN tren — botón "Historial" de la tarjeta de
// Mediciones (ver MedicionesTarjetas). Misma tabla que la vista permanente
// de Mediciones (TablaScanRecords), acotada por tren vía ?tren=N.
export function MedicionesHistorico() {
  const [searchParams] = useSearchParams()
  const tren = Number(searchParams.get('tren'))
  const trenValido = Number.isInteger(tren) && tren > 0

  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)
  const [filaEditando, setFilaEditando] = useState<PreviewRow | null>(null)
  const [filaAEliminar, setFilaAEliminar] = useState<PreviewRow | null>(null)

  const params: PreviewParams = {
    tren: trenValido ? tren : undefined,
    page,
    pageSize: PAGE_SIZE,
    ...(sorting[0] ? { sortBy: sorting[0].id as PreviewParams['sortBy'], sortDir: sorting[0].desc ? 'desc' : 'asc' } : {}),
  }

  const preview = useScanRecordsPreview(ALCANCE_CONFIRMADOS, params)
  const eliminarFila = useEliminarScanRecordFila(ALCANCE_CONFIRMADOS)
  const editarFila = useEditarScanRecordFila(ALCANCE_CONFIRMADOS)
  const totalPaginas = preview.data?.totalPaginas ?? preview.data?.totalPages ?? 1

  async function confirmarEliminarFila() {
    if (!filaAEliminar) return
    await eliminarFila.mutateAsync(filaAEliminar.id)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/mediciones" className="mb-4 inline-flex items-center gap-1 font-body text-sm text-concreto transition-colors hover:text-concreto-oscuro">
        <ChevronLeft size={16} aria-hidden />
        Volver a Mediciones
      </Link>

      <GlassSurface className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
            Historial {trenValido ? `— Tren ${tren}` : ''}
          </h1>
          <p className="mt-0.5 font-body text-sm text-concreto">
            <span className="font-data">{preview.data?.total ?? 0}</span> mediciones confirmadas
          </p>
        </div>
      </GlassSurface>

      {!trenValido ? (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          Falta el número de tren (parámetro «tren» en la URL).
        </p>
      ) : preview.isLoading ? (
        <p className="py-12 text-center font-body text-sm text-concreto">Cargando…</p>
      ) : preview.isError ? (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(preview.error)}
        </p>
      ) : (
        <TablaScanRecords
          rows={preview.data?.rows ?? []}
          sorting={sorting}
          onSortingChange={setSorting}
          mostrarColumnaTren={false}
          onEditar={setFilaEditando}
          onEliminar={setFilaAEliminar}
        />
      )}

      <div className="mt-4">
        <PaginacionNumerica page={page} totalPaginas={totalPaginas} onPage={setPage} />
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
