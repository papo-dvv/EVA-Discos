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
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { PreviewRow } from '../types'

// Columnas cuyos valores son numéricos → tipografía mono, alineados a la
// derecha (styles.md §6.1: los datos de medición se leen como instrumento).
const COLUMNAS_MONO = new Set([
  'tren',
  'kilometraje',
  'numeroCoche',
  'eje',
  'rueda',
  'h',
  't',
  'rd',
])

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
  compacta?: boolean
  sinScrollInterno?: boolean
  scrollHorizontal?: boolean
}

export function TablaScanRecords({
  rows,
  sorting,
  onSortingChange,
  mostrarColumnaTren,
  onEditar,
  onEliminar,
  accionesDeshabilitadas = false,
  compacta = false,
  sinScrollInterno = false,
  scrollHorizontal = false,
}: Props) {
  const columns = useMemo(
    () =>
      construirColumnas(onEditar, onEliminar, accionesDeshabilitadas, compacta),
    [onEditar, onEliminar, accionesDeshabilitadas, compacta],
  )

  // TanStack Table administra su propia memoización; React Compiler omite este hook de forma segura.
  // eslint-disable-next-line react-hooks/incompatible-library
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

  const tabla = (
    <table
      className={`border-collapse text-left font-body ${
        compacta
          ? 'min-w-[72rem] table-fixed text-[0.71rem]'
          : 'w-full text-[0.8125rem]'
      }`}
    >
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
                  onClick={
                    puedeOrdenar
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                  className={`bg-[color:var(--color-arena-suave)] font-semibold uppercase tracking-wide text-concreto ${
                    sinScrollInterno ? '' : 'sticky top-0 z-[1]'
                  } ${
                    compacta
                      ? 'whitespace-normal break-words px-1 py-2 text-[0.6875rem] leading-tight'
                      : 'whitespace-nowrap px-3 py-3 text-xs'
                  } ${
                    mono ? 'text-right' : 'text-left'
                  } ${puedeOrdenar ? 'cursor-pointer select-none hover:text-concreto-oscuro' : ''}`}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {orden === 'asc' ? ' ▲' : orden === 'desc' ? ' ▼' : ''}
                </th>
              )
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className="tabla-fila--glass border-b border-concreto/10"
          >
            {row.getVisibleCells().map((cell) => {
              const mono = COLUMNAS_MONO.has(cell.column.id)
              return (
                <td
                  key={cell.id}
                  className={`overflow-hidden text-concreto-oscuro ${
                    compacta
                      ? 'whitespace-nowrap px-1 py-2 leading-tight'
                      : 'whitespace-nowrap px-3 py-2.5'
                  } ${mono ? 'text-right font-data' : ''}`}
                  title={String(cell.getValue() ?? '')}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              )
            })}
          </tr>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <tr>
            <td
              colSpan={columns.length}
              className="px-4 py-8 text-center font-body text-sm text-concreto"
            >
              Sin filas para el filtro actual.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )

  return (
    <GlassSurface
      fuerte
      className={`mt-4 rounded-glass ${sinScrollInterno ? 'overflow-visible' : 'overflow-hidden'}`}
    >
      {sinScrollInterno && scrollHorizontal ? (
        <ScrollArea ejes="x">{tabla}</ScrollArea>
      ) : sinScrollInterno ? (
        tabla
      ) : (
        <ScrollArea ejes="both" viewportClassName="max-h-[64vh]">
          {tabla}
        </ScrollArea>
      )}
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
  if (row.corregidoNumeroCoche) {
    const original =
      row.numeroCocheOriginalExcel === null
        ? 'vacío'
        : row.numeroCocheOriginalExcel
    partes.push(
      `N° Coche corregido: la planilla decía ${original}, se usó ${row.numeroCocheExcel} según la relación oficial ${row.cocheExcel} del tren ${row.trenNumero}.`,
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
  compacta: boolean,
) {
  const columnas = [
    columnHelper.display({
      id: 'advertencia',
      header: '⚠',
      enableSorting: false,
      cell: ({ row }) => {
        const texto = textoAdvertencia(row.original)
        return texto ? <WarningTooltip texto={texto}>⚠️</WarningTooltip> : null
      },
    }),
    // Columna Tren — solo visible en "Todos" (columnVisibility). No ordenable:
    // el backend no acepta 'tren' como sortBy.
    columnHelper.accessor('trenNumero', {
      id: 'tren',
      header: 'Tren',
      enableSorting: false,
    }),
    columnHelper.accessor('responsableNombre', {
      id: 'responsable',
      header: 'Responsable',
    }),
    columnHelper.accessor('kilometraje', {
      id: 'kilometraje',
      header: 'Kilometraje',
    }),
    columnHelper.accessor('motivo', { id: 'motivo', header: 'Motivo' }),
    columnHelper.accessor('cocheExcel', { id: 'coche', header: 'Coche' }),
    columnHelper.accessor('numeroCocheExcel', {
      id: 'numeroCoche',
      header: 'N° Coche',
    }),
    columnHelper.accessor('bogieExcel', { id: 'bogie', header: 'Bogie' }),
    columnHelper.accessor('ejeExcel', { id: 'eje', header: 'Eje' }),
    columnHelper.accessor('ruedaExcel', { id: 'rueda', header: 'Rueda' }),
    // No ordenable ni del backend: cálculo puro por paridad del número de
    // rueda (impar = izquierdo, par = derecho) — no existe como sortBy en
    // ColumnaOrdenable ni depende de ningún campo nuevo de PreviewRow.
    columnHelper.display({
      id: 'lado',
      header: 'Lado',
      enableSorting: false,
      cell: ({ row }) => ladoPorRueda(row.original.ruedaExcel),
    }),
    // Solo trae valor en filas Ansaldo (interior/exterior) — vacía para
    // Alstom, que no distingue posición dentro de un mismo lado.
    columnHelper.display({
      id: 'posicion',
      header: 'Posición',
      enableSorting: false,
      cell: ({ row }) => posicionPorUbicacion(row.original.ubicacionExcel),
    }),
    // Después de Lado, no de Kilometraje: refleja el orden jerárquico del
    // backend (tren→coche→bogie→eje→rueda→fecha, ver ORDEN_FISICO_DEFECTO en
    // scan-record-query.ts), donde fecha es el desempate final entre filas
    // del mismo eje+rueda.
    columnHelper.accessor('fecha', { id: 'fecha', header: 'Fecha' }),
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
      cell: ({ getValue }) => (
        <EstadoChip estado={getValue()} compacta={compacta} />
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
                className={`rounded-full border border-concreto/30 font-body text-concreto-oscuro transition-colors hover:bg-white/60 disabled:opacity-40 ${
                  compacta ? 'px-2 py-0.5 text-[0.71rem]' : 'px-3 py-1 text-xs'
                }`}
              >
                Editar
              </button>
            )}
            {onEliminar && (
              <button
                type="button"
                onClick={() => onEliminar(row.original)}
                disabled={deshabilitado}
                className={`rounded-full border border-[color:var(--color-estado-critico)]/40 font-body text-[color:var(--color-estado-critico)] transition-colors hover:bg-white/60 disabled:opacity-40 ${
                  compacta ? 'px-2 py-0.5 text-[0.71rem]' : 'px-3 py-1 text-xs'
                }`}
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

// Chip de estado de alto contraste (§6.1) — sólido, nunca glass. REPERFILADO
// reutiliza el magenta ya definido en styles.md (antes era una etiqueta de
// acción aparte; ahora es un quinto valor más del propio chip de Estado).
const CLASE_CHIP_ESTADO: Record<string, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

function EstadoChip({
  estado,
  compacta = false,
}: {
  estado: string | null
  compacta?: boolean
}) {
  if (!estado) return null
  return (
    <span
      className={`tabla-chip ${compacta ? '!px-2 !py-1 !text-[0.71rem]' : ''} ${CLASE_CHIP_ESTADO[estado] ?? ''}`}
    >
      {estado}
    </span>
  )
}

// Cálculo puro en frontend, sin campo propio en PreviewRow: impar =
// izquierdo, par = derecho (convención física del eje, ver ubicación en el
// Excel origen). null si la rueda no se resolvió.
function ladoPorRueda(rueda: number | null): string | null {
  if (rueda === null) return null
  return rueda % 2 === 1 ? 'Izquierdo' : 'Derecho'
}

// Ansaldo trae 2 discos por lado (interior/exterior) — se distingue por el
// sufijo del texto crudo de Ubicación ("..._I_ext"/"..._I_int"/etc., ver
// resolverLadoYPosicion en el backend). null para Alstom (sin esa distinción).
function posicionPorUbicacion(ubicacion: string | null): string | null {
  const match = /_[id]_(ext|int)$/i.exec((ubicacion ?? '').trim())
  if (!match) return null
  return match[1].toLowerCase() === 'ext' ? 'Exterior' : 'Interior'
}
