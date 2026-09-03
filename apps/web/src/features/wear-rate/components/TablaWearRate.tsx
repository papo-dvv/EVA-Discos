import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { useMemo, useState, type CSSProperties } from 'react'
import {
  calcularInfoPinPosicion,
  columnaIdentidadToggle,
  COLUMNAS_MONO_POSICION,
  estiloBodyPinPosicion,
  estiloHeaderPinPosicion,
} from '../../../components/columnaPosicion'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { FilaWearRate } from '../types'

// Columnas cuyos valores son numéricos → tipografía mono, alineados a la
// derecha (styles.md §6.1: los datos de medición se leen como instrumento).
// Los ids coinciden 1:1 con COLUMNAS_ORDENABLES_WEAR_RATE del backend: el
// sortBy que manda la página es directamente sorting[0].id, sin traducción.
// Las 5 columnas de identidad del disco (pinneadas) también usan font-data,
// aunque no sean ordenables — mismo estilo visual que el resto de la tabla.
const COLUMNAS_MONO = new Set([
  'trenNumero',
  'km1',
  'rd1',
  'km2',
  'rd2',
  'diferenciaKm',
  'diferenciaRd',
  'tasa',
  'kmMensualUsado',
  'tasaMensual',
  ...COLUMNAS_MONO_POSICION,
])

type Props = {
  rows: FilaWearRate[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  mostrarColumnaTren: boolean
}

export function TablaWearRate({ rows, sorting, onSortingChange, mostrarColumnaTren }: Props) {
  const [identidadAbierta, setIdentidadAbierta] = useState(false)
  const { infos: pinInfo, ultimo: ultimoPin } = useMemo(
    () => calcularInfoPinPosicion(identidadAbierta),
    [identidadAbierta],
  )
  const estiloHeaderPin = (id: string): CSSProperties | undefined =>
    estiloHeaderPinPosicion(pinInfo, ultimoPin, id)
  const estiloBodyPin = (id: string): CSSProperties | undefined =>
    estiloBodyPinPosicion(pinInfo, ultimoPin, id)

  const columns = useMemo(
    () => construirColumnas(identidadAbierta, () => setIdentidadAbierta((a) => !a)),
    [identidadAbierta],
  )

  // TanStack Table administra su propia memoización; React Compiler omite este hook de forma segura.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility: {
        trenNumero: mostrarColumnaTren,
        identidadCoche: identidadAbierta,
        identidadNumeroCoche: identidadAbierta,
        identidadBogie: identidadAbierta,
        identidadEje: identidadAbierta,
        identidadLado: identidadAbierta,
      },
    },
    onSortingChange,
    manualSorting: true,
    manualPagination: true,
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
                      style={estiloHeaderPin(header.column.id)}
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
                  // La columna de estado/comentario puede traer varios
                  // motivos unidos con '; ' — se deja envolver en vez de
                  // truncar, para que la advertencia sea legible sin hover.
                  const envolver = cell.column.id === 'estado'
                  return (
                    <td
                      key={cell.id}
                      style={estiloBodyPin(cell.column.id)}
                      className={`px-3 py-2.5 text-concreto-oscuro ${
                        envolver ? 'max-w-[22rem] whitespace-normal' : 'whitespace-nowrap'
                      } ${mono ? 'text-right font-data' : ''}`}
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
                  Sin pares de tasa de desgaste para el filtro actual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </GlassSurface>
  )
}

const columnHelper = createColumnHelper<FilaWearRate>()

function construirColumnas(identidadAbierta: boolean, alternarIdentidad: () => void) {
  return [
    columnaIdentidadToggle(columnHelper, identidadAbierta, alternarIdentidad),
    columnHelper.accessor('tipoCoche', { id: 'identidadCoche', header: 'Coche', enableSorting: false }),
    columnHelper.accessor('numeroCoche', {
      id: 'identidadNumeroCoche',
      header: 'N.° coche',
      enableSorting: false,
    }),
    columnHelper.accessor('bogieCodigo', { id: 'identidadBogie', header: 'Bogie', enableSorting: false }),
    columnHelper.accessor('ejeNumero', { id: 'identidadEje', header: 'Eje', enableSorting: false }),
    columnHelper.accessor('lado', {
      id: 'identidadLado',
      header: 'Lado',
      enableSorting: false,
      cell: ({ getValue }) => (getValue() === 'izquierdo' ? 'Izquierdo' : 'Derecho'),
    }),
    columnHelper.accessor('trenNumero', { id: 'trenNumero', header: 'Tren' }),
    columnHelper.accessor('fecha1', { id: 'fecha1', header: 'Fecha 1' }),
    columnHelper.accessor('km1', { id: 'km1', header: 'Km 1' }),
    columnHelper.accessor('rd1', {
      id: 'rd1',
      header: 'Rd 1',
      cell: ({ getValue }) => getValue().toFixed(2),
    }),
    columnHelper.accessor('fecha2', { id: 'fecha2', header: 'Fecha 2' }),
    columnHelper.accessor('km2', { id: 'km2', header: 'Km 2' }),
    columnHelper.accessor('rd2', {
      id: 'rd2',
      header: 'Rd 2',
      cell: ({ getValue }) => getValue().toFixed(2),
    }),
    columnHelper.accessor('motivo2', {
      id: 'motivo2',
      header: 'Motivo de Fecha 2',
      enableSorting: false,
    }),
    columnHelper.accessor('diferenciaKm', {
      id: 'diferenciaKm',
      header: 'Diferencia de Km',
      cell: ({ getValue }) => getValue().toFixed(2),
    }),
    columnHelper.accessor('diferenciaRd', {
      id: 'diferenciaRd',
      header: 'Diferencia de Rd',
      cell: ({ getValue }) => getValue().toFixed(2),
    }),
    // Se muestra el valor YA formateado por el backend (decimales variables,
    // 7 a 9 — ver formatearTasa en WearRateCalculatorService), nunca
    // reformateado en el frontend.
    columnHelper.accessor('tasaFormateada', { id: 'tasa', header: 'Tasa' }),
    columnHelper.accessor('kmMensualUsado', {
      id: 'kmMensualUsado',
      header: 'Km Mensual',
      enableSorting: false,
    }),
    columnHelper.accessor('tasaMensualFormateada', { id: 'tasaMensual', header: 'Tasa Mensual' }),
    columnHelper.display({
      id: 'estado',
      header: 'Comentario / Estado',
      enableSorting: false,
      cell: ({ row }) => (
        <EstadoValidezChip esValido={row.original.esValido} comentario={row.original.comentario} />
      ),
    }),
  ]
}

// Chip de alto contraste (§6.1), igual convención que la tabla de mediciones:
// verde institucional cuando el par es válido; tono de Seguimiento (ámbar,
// NO el rojo de Crítico) cuando no lo es — esto no es un estado del disco,
// es una nota de cálculo, y el chip muestra el/los motivo(s) directamente.
function EstadoValidezChip({ esValido, comentario }: { esValido: boolean; comentario: string }) {
  if (esValido) {
    return <span className="tabla-chip tabla-chip--ok">Válido</span>
  }
  return (
    <WarningTooltip texto={comentario}>
      <span className="tabla-chip tabla-chip--seguimiento tabla-chip--envolver">{comentario}</span>
    </WarningTooltip>
  )
}
