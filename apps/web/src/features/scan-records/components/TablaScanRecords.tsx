import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import type { AccionRecomendada, LadoAfectado, PreviewRow } from '../types'

// Columnas cuyos valores son numéricos → tipografía mono, alineados a la
// derecha (styles.md §6.1: los datos de medición se leen como instrumento).
const COLUMNAS_MONO = new Set(['tren', 'kilometraje', 'numeroCoche', 'eje', 'rueda', 'h', 't', 'rd'])

// Tabla virtualizada (scroll propio) de mediciones, compartida entre la vista
// previa de una migración en curso y la vista permanente de confirmados.
// Editar/eliminar por fila son OPCIONALES: si no se pasan, esas acciones
// simplemente no se renderizan (ej. un modo de solo lectura futuro).
type Props = {
  rows: PreviewRow[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  mostrarColumnaTren: boolean
  onEditar?: (row: PreviewRow) => void
  onEliminar?: (row: PreviewRow) => void
  accionesDeshabilitadas?: boolean
}

export function TablaScanRecords({
  rows,
  sorting,
  onSortingChange,
  mostrarColumnaTren,
  onEditar,
  onEliminar,
  accionesDeshabilitadas = false,
}: Props) {
  const columns = useMemo(
    () => construirColumnas(onEditar, onEliminar, accionesDeshabilitadas),
    [onEditar, onEliminar, accionesDeshabilitadas],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility: { tren: mostrarColumnaTren },
    },
    onSortingChange,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <ScrollArea ejes="both" viewportClassName="max-h-[64vh]">
        <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-concreto/20">
                {hg.headers.map((header) => {
                  const puedeOrdenar = header.column.getCanSort()
                  const orden = header.column.getIsSorted()
                  const mono = COLUMNAS_MONO.has(header.column.id)
                  return (
                    <th
                      key={header.id}
                      onClick={puedeOrdenar ? header.column.getToggleSortingHandler() : undefined}
                      className={`sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-concreto ${
                        mono ? 'text-right' : 'text-left'
                      } ${puedeOrdenar ? 'cursor-pointer select-none hover:text-concreto-oscuro' : ''}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {orden === 'asc' ? ' ▲' : orden === 'desc' ? ' ▼' : ''}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="tabla-fila--glass border-b border-concreto/10">
                {row.getVisibleCells().map((cell) => {
                  const mono = COLUMNAS_MONO.has(cell.column.id)
                  return (
                    <td
                      key={cell.id}
                      className={`whitespace-nowrap px-3 py-2.5 text-concreto-oscuro ${
                        mono ? 'text-right font-data' : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center font-body text-sm text-concreto">
                  Sin filas para el filtro actual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </GlassSurface>
  )
}

const columnHelper = createColumnHelper<PreviewRow>()

function textoAdvertencia(row: PreviewRow): string | null {
  const partes: string[] = []
  if (row.corregidoPorHoja) {
    partes.push(
      `Tren corregido: la planilla decía ${row.trenOriginalExcel}, se usó ${row.trenNumero} según la hoja ${row.hojaExcelOrigen}.`,
    )
  }
  if (row.discrepanciaEstadoExcel) {
    partes.push(
      `Estado recalculado: el sistema calculó ${row.estadoCalculado}, la planilla sugería "${row.estadoSugeridoExcel}".`,
    )
  }
  return partes.length > 0 ? partes.join(' ') : null
}

function construirColumnas(
  onEditar: ((row: PreviewRow) => void) | undefined,
  onEliminar: ((row: PreviewRow) => void) | undefined,
  deshabilitado: boolean,
) {
  const columnas = [
    columnHelper.display({
      id: 'advertencia',
      header: '⚠',
      enableSorting: false,
      cell: ({ row }) => {
        const texto = textoAdvertencia(row.original)
        return texto ? (
          <span title={texto} className="cursor-help">
            ⚠️
          </span>
        ) : null
      },
    }),
    // Columna Tren — solo visible en "Todos" (columnVisibility). No ordenable:
    // el backend no acepta 'tren' como sortBy.
    columnHelper.accessor('trenNumero', {
      id: 'tren',
      header: 'Tren',
      enableSorting: false,
    }),
    columnHelper.accessor('responsableNombre', { id: 'responsable', header: 'Responsable' }),
    columnHelper.accessor('kilometraje', { id: 'kilometraje', header: 'Kilometraje' }),
    columnHelper.accessor('fecha', { id: 'fecha', header: 'Fecha' }),
    columnHelper.accessor('motivo', { id: 'motivo', header: 'Motivo' }),
    columnHelper.accessor('cocheExcel', { id: 'coche', header: 'Coche' }),
    columnHelper.accessor('numeroCocheExcel', { id: 'numeroCoche', header: 'N° Coche' }),
    columnHelper.accessor('bogieExcel', { id: 'bogie', header: 'Bogie' }),
    columnHelper.accessor('ejeExcel', { id: 'eje', header: 'Eje' }),
    columnHelper.accessor('ruedaExcel', { id: 'rueda', header: 'Rueda' }),
    columnHelper.accessor('hValue', { id: 'h', header: 'H' }),
    columnHelper.accessor('tValue', { id: 't', header: 'T' }),
    columnHelper.accessor('rdValue', {
      id: 'rd',
      header: 'Rd',
      cell: ({ getValue }) => getValue().toFixed(2),
    }),
    columnHelper.accessor('estadoCalculado', {
      id: 'estado',
      header: 'Estado',
      cell: ({ getValue }) => <EstadoChip estado={getValue()} />,
    }),
    // No ordenable: es una propiedad DEL EJE calculada por el backend
    // cruzando ambos lados (accion-recomendada.query.ts), no una columna de
    // scan_records — no existe como sortBy en ColumnaOrdenable.
    columnHelper.display({
      id: 'accionRecomendada',
      header: 'Acción recomendada',
      enableSorting: false,
      cell: ({ row }) => (
        <AccionChip accion={row.original.accionRecomendada} lado={row.original.ladoAfectado} />
      ),
    }),
  ]

  if (onEditar || onEliminar) {
    columnas.push(
      columnHelper.display({
        id: 'acciones',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex gap-1.5">
            {onEditar && (
              <button
                type="button"
                onClick={() => onEditar(row.original)}
                disabled={deshabilitado}
                className="rounded-full border border-concreto/30 px-3 py-1 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60 disabled:opacity-40"
              >
                Editar
              </button>
            )}
            {onEliminar && (
              <button
                type="button"
                onClick={() => onEliminar(row.original)}
                disabled={deshabilitado}
                className="rounded-full border border-[color:var(--color-estado-critico)]/40 px-3 py-1 font-body text-xs text-[color:var(--color-estado-critico)] transition-colors hover:bg-white/60 disabled:opacity-40"
              >
                Eliminar
              </button>
            )}
          </span>
        ),
      }),
    )
  }

  return columnas
}

// Chip de estado de alto contraste (§6.1) — sólido, nunca glass.
const CLASE_CHIP_ESTADO: Record<string, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
}

function EstadoChip({ estado }: { estado: string | null }) {
  if (!estado) return null
  return <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado] ?? ''}`}>{estado}</span>
}

// Etiqueta de acción/motivo (styles.md §6.1) — NO reemplaza al chip de
// estado, se muestran ambos si corresponde (ej. estado "Seguimiento" +
// acción "Reperfilado" tras la intervención). Cambio/Crítico reutilizan el
// mismo color sólido que su chip de estado homónimo; Reperfilado usa el
// magenta dedicado (para no confundirse con Cambio).
const CLASE_CHIP_ACCION: Record<Exclude<AccionRecomendada, 'NINGUNA'>, string> = {
  REPERFILADO: 'tabla-chip--reperfilado',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
}
const ETIQUETA_ACCION: Record<Exclude<AccionRecomendada, 'NINGUNA'>, string> = {
  REPERFILADO: 'Reperfilado',
  CAMBIO: 'Cambio',
  CRITICO: 'Crítico',
}
const ETIQUETA_LADO: Record<Exclude<LadoAfectado, null>, string> = {
  izquierdo: 'izq.',
  derecho: 'der.',
  ambos: 'ambos lados',
}

function AccionChip({ accion, lado }: { accion: AccionRecomendada | null; lado: LadoAfectado }) {
  if (!accion || accion === 'NINGUNA') return null
  return (
    <span className={`tabla-chip ${CLASE_CHIP_ACCION[accion]}`}>
      {ETIQUETA_ACCION[accion]}
      {lado && ` · ${ETIQUETA_LADO[lado]}`}
    </span>
  )
}
