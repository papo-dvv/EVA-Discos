import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ChevronUp, Layers, Link2 } from 'lucide-react'
import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
import type { EstadoDisco, LadoDisco } from '../../scan-records/types'
import type { CicloReperfilado, FilaProyeccion } from '../types'

const COLUMNAS_MONO = new Set(['h', 't', 'rd', ...COLUMNAS_MONO_POSICION])

// Mismas clases tabla-chip--* (styles.md §6.1) que ya usa el chip de Estado
// de Mediciones confirmadas (ver EstadoChip en TablaScanRecords.tsx) — se
// repite localmente en vez de extraerse a un componente compartido, mismo
// criterio que EstadoValidezChip en TablaWearRate (cada tabla define su
// propio chip pequeño, la clase CSS es lo único realmente compartido).
const CLASE_CHIP_ESTADO: Record<EstadoDisco, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

function EstadoChip({ estado }: { estado: EstadoDisco }) {
  return <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>{estado}</span>
}

// El eje tiene exactamente 2 discos (izquierdo/derecho) — el lado que "presta"
// su fecha antepuesta es siempre el opuesto al lado propio de esta fila (ver
// ProyeccionService.resolverOverridesPorEje en el backend).
function ladoHermano(lado: LadoDisco): LadoDisco {
  return lado === 'izquierdo' ? 'derecho' : 'izquierdo'
}

// H/T/Rd del momento exacto de un ciclo proyectado (reperfilado) — en texto
// chico, font-data, debajo de la fecha. Sin datos equivalentes para
// cicloCambio: el backend no expone H/T ahí (Rd en cambio es, por
// definición, el umbral configurado — no un valor propio de este disco).
function DetalleHTRd({
  h,
  t,
  rdAntes,
  rdDespues,
}: {
  h: number
  t: number
  rdAntes: number
  rdDespues: number
}) {
  return (
    <p className="mt-0.5 font-data text-[0.6875rem] leading-tight text-concreto">
      H {h.toFixed(2)} · T {t.toFixed(2)} · Rd {rdAntes.toFixed(2)} ➔ {rdDespues.toFixed(2)}
    </p>
  )
}

// "— Sin datos" (con motivo en tooltip) cuando el disco no es proyectable —
// distinto de un "—" liso (disco proyectable, simplemente sin ese ciclo) para
// que la ausencia de tasa de desgaste no se lea como "no necesita nada".
// `detalle` es el H/T/Rd de ese momento (solo tiene sentido para reperfilado,
// ver DetalleHTRd) — cicloCambio no lo pasa. `fechaPropiaSiFueraIndependiente`
// + `ladoPropio` arman el ícono de referencia cruzada (Parte 5) cuando esta
// fecha realmente pertenece al lado hermano.
function CeldaFecha({
  fecha,
  motivoSinDatos,
  detalle,
  fechaPropiaSiFueraIndependiente,
  ladoPropio,
}: {
  fecha: string | null
  motivoSinDatos?: string | null
  detalle?: ReactNode
  fechaPropiaSiFueraIndependiente?: string | null
  ladoPropio?: LadoDisco
}) {
  if (fecha) {
    return (
      <div>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-data">{fecha}</span>
          {fechaPropiaSiFueraIndependiente && ladoPropio && (
            <WarningTooltip
              texto={`Este lado proyectaría ${fechaPropiaSiFueraIndependiente} de forma independiente, pero se muestra la fecha del lado ${ladoHermano(ladoPropio)} por ser más próxima.`}
            >
              <Link2
                size={12}
                strokeWidth={2.25}
                className="text-verde-institucional"
                aria-label="Fecha del lado hermano de este eje"
              />
            </WarningTooltip>
          )}
        </span>
        {detalle}
      </div>
    )
  }
  if (motivoSinDatos) {
    return (
      <WarningTooltip texto={motivoSinDatos}>
        <span className="text-concreto">— Sin datos</span>
      </WarningTooltip>
    )
  }
  return <span className="text-concreto">—</span>
}

type Props = {
  rows: FilaProyeccion[]
  mostrarColumnaTren: boolean
}

// Tabla principal de Proyección de Reperfilado y Cambio. Reutiliza la
// columna/panel de posición pinneado de columnaPosicion.tsx (mismo componente
// que Tasa de Desgaste). Los ciclos 2°-5° de reperfilado no son columnas
// fijas (varían de 0 a 4 por disco): se muestran en una fila de detalle
// expandible debajo de la fila, por disco (botón ▸/▾) o globalmente con
// "Mostrar todos los ciclos".
export function TablaProyeccion({ rows, mostrarColumnaTren }: Props) {
  const [identidadAbierta, setIdentidadAbierta] = useState(false)
  const [filasExpandidas, setFilasExpandidas] = useState<Set<string>>(new Set())
  const [mostrarTodosLosCiclos, setMostrarTodosLosCiclos] = useState(false)

  const { infos: pinInfo, ultimo: ultimoPin } = useMemo(
    () => calcularInfoPinPosicion(identidadAbierta),
    [identidadAbierta],
  )
  const estiloHeaderPin = (id: string): CSSProperties | undefined =>
    estiloHeaderPinPosicion(pinInfo, ultimoPin, id)
  const estiloBodyPin = (id: string): CSSProperties | undefined => estiloBodyPinPosicion(pinInfo, ultimoPin, id)

  function alternarFila(discId: string) {
    setFilasExpandidas((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(discId)) siguiente.delete(discId)
      else siguiente.add(discId)
      return siguiente
    })
  }
  function estaExpandida(fila: FilaProyeccion): boolean {
    return mostrarTodosLosCiclos || filasExpandidas.has(fila.discId)
  }

  const columns = useMemo(
    () => construirColumnas(identidadAbierta, () => setIdentidadAbierta((a) => !a), estaExpandida, alternarFila),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estaExpandida/alternarFila se recrean cada render, pero solo leen/escriben estado propio (no cambian la forma de las columnas).
    [identidadAbierta, mostrarTodosLosCiclos, filasExpandidas],
  )

  // TanStack Table administra su propia memoización; React Compiler omite este hook de forma segura.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnVisibility: {
        trenNumero: mostrarColumnaTren,
        identidadCoche: identidadAbierta,
        identidadNumeroCoche: identidadAbierta,
        identidadBogie: identidadAbierta,
        identidadEje: identidadAbierta,
        identidadLado: identidadAbierta,
      },
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div className="flex items-center justify-end gap-2 border-b border-concreto/20 px-3 py-2">
        <button
          type="button"
          onClick={() => setMostrarTodosLosCiclos((m) => !m)}
          className="rounded-full border border-concreto/30 bg-white/55 px-3 py-1.5 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/70"
        >
          {mostrarTodosLosCiclos ? 'Ocultar todos los ciclos' : 'Mostrar todos los ciclos'}
        </button>
      </div>
      <ScrollArea ejes="both" viewportClassName="max-h-[64vh]">
        <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-concreto/20">
                {hg.headers.map((header) => {
                  const mono = COLUMNAS_MONO.has(header.column.id)
                  return (
                    <th
                      key={header.id}
                      style={estiloHeaderPin(header.column.id)}
                      className={`sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-concreto ${
                        mono ? 'text-right' : 'text-left'
                      }`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const fila = row.original
              const expandida = estaExpandida(fila)
              return (
                <Fragment key={row.id}>
                  <tr className="tabla-fila--glass border-b border-concreto/10">
                    {row.getVisibleCells().map((cell) => {
                      const mono = COLUMNAS_MONO.has(cell.column.id)
                      return (
                        <td
                          key={cell.id}
                          style={estiloBodyPin(cell.column.id)}
                          className={`whitespace-nowrap px-3 py-2.5 text-concreto-oscuro ${mono ? 'text-right font-data' : ''}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                  {expandida && fila.ciclosReperfilado.length > 1 && (
                    <tr className="border-b border-concreto/10 bg-white/40">
                      <td colSpan={row.getVisibleCells().length} className="px-3 py-2.5">
                        <DetalleCiclos ciclos={fila.ciclosReperfilado.slice(1)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center font-body text-sm text-concreto">
                  Sin discos para el filtro actual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </GlassSurface>
  )
}

// Ciclos 2°-5° (el 1° ya vive en la columna "Siguiente reperfilado") — cada
// uno como una tarjeta compacta con su número, fecha estimada y H/Rd
// proyectados tras ese reperfilado.
function DetalleCiclos({ ciclos }: { ciclos: CicloReperfilado[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {ciclos.map((c) => (
        <div
          key={c.numero}
          className="rounded-xl border border-concreto/20 bg-white/60 px-3 py-2 font-body text-xs text-concreto-oscuro"
        >
          <p className="font-semibold uppercase tracking-[0.08em] text-concreto">Ciclo {c.numero}</p>
          <p className="mt-0.5 font-data">{c.fechaEstimada}</p>
          <p className="mt-0.5 text-concreto">
            H <span className="font-data text-concreto-oscuro">{c.hEnEseMomento.toFixed(2)}</span> · T{' '}
            <span className="font-data text-concreto-oscuro">{c.tEnEseMomento.toFixed(2)}</span> · Rd antes{' '}
            <span className="font-data text-concreto-oscuro">{c.rdAntes.toFixed(2)}</span> · Rd después{' '}
            <span className="font-data text-concreto-oscuro">{c.rdDespues.toFixed(2)}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

const columnHelper = createColumnHelper<FilaProyeccion>()

function construirColumnas(
  identidadAbierta: boolean,
  alternarIdentidad: () => void,
  estaExpandida: (fila: FilaProyeccion) => boolean,
  alternarFila: (discId: string) => void,
) {
  return [
    columnaIdentidadToggle(columnHelper, identidadAbierta, alternarIdentidad),
    columnHelper.accessor((row) => row.posicion.tipoCoche, { id: 'identidadCoche', header: 'Coche' }),
    columnHelper.accessor((row) => row.posicion.numeroCoche, {
      id: 'identidadNumeroCoche',
      header: 'N.° coche',
    }),
    columnHelper.accessor((row) => row.posicion.bogieCodigo, { id: 'identidadBogie', header: 'Bogie' }),
    columnHelper.accessor((row) => row.posicion.ejeNumero, { id: 'identidadEje', header: 'Eje' }),
    columnHelper.accessor((row) => row.posicion.lado, {
      id: 'identidadLado',
      header: 'Lado',
      cell: ({ getValue }) => (getValue() === 'izquierdo' ? 'Izquierdo' : 'Derecho'),
    }),
    columnHelper.accessor('trenNumero', { id: 'trenNumero', header: 'Tren' }),
    columnHelper.accessor('fechaUltimaMedicion', {
      id: 'fechaUltimaMedicion',
      header: 'Última medición',
    }),
    columnHelper.accessor('h', { id: 'h', header: 'H', cell: ({ getValue }) => getValue().toFixed(2) }),
    columnHelper.accessor('t', { id: 't', header: 'T', cell: ({ getValue }) => getValue().toFixed(2) }),
    columnHelper.accessor('rd', { id: 'rd', header: 'Rd', cell: ({ getValue }) => getValue().toFixed(2) }),
    columnHelper.display({
      id: 'estado',
      header: 'Estado',
      cell: ({ row }) => <EstadoChip estado={row.original.estado} />,
    }),
    columnHelper.display({
      id: 'siguienteReperfilado',
      header: 'Siguiente reperfilado',
      cell: ({ row }) => {
        const fila = row.original
        const ciclo = fila.ciclosReperfilado[0]
        return (
          <CeldaFecha
            fecha={ciclo?.fechaEstimada ?? null}
            motivoSinDatos={fila.proyectable ? null : fila.motivo}
            detalle={
              ciclo && (
                <DetalleHTRd
                  h={ciclo.hEnEseMomento}
                  t={ciclo.tEnEseMomento}
                  rdAntes={ciclo.rdAntes}
                  rdDespues={ciclo.rdDespues}
                />
              )
            }
            fechaPropiaSiFueraIndependiente={ciclo?.fechaPropiaSiFueraIndependiente}
            ladoPropio={fila.posicion.lado}
          />
        )
      },
    }),
    columnHelper.display({
      id: 'siguienteCambio',
      header: 'Siguiente cambio',
      cell: ({ row }) => {
        const fila = row.original
        return (
          <CeldaFecha
            fecha={fila.cicloCambio?.fechaEstimada ?? null}
            motivoSinDatos={fila.proyectable ? null : fila.motivo}
            fechaPropiaSiFueraIndependiente={fila.cicloCambio?.fechaPropiaSiFueraIndependiente}
            ladoPropio={fila.posicion.lado}
          />
        )
      },
    }),
    columnHelper.display({
      id: 'expandirCiclos',
      header: '',
      cell: ({ row }) => {
        const fila = row.original
        const extra = fila.ciclosReperfilado.length - 1
        if (extra <= 0) return null
        const expandida = estaExpandida(fila)
        const etiqueta = expandida ? 'Ocultar ciclos adicionales' : `Mostrar ${extra} ciclo(s) adicionales`
        return (
          <button
            type="button"
            onClick={() => alternarFila(fila.discId)}
            aria-label={etiqueta}
            title={etiqueta}
            // Badge propio (ícono + contador "+N"), a propósito distinto del
            // triángulo ▸/▾ genérico que ya usa columnaIdentidadToggle en esta
            // misma tabla — acá el ícono cambia (Layers/ChevronUp, no
            // triángulo) y suma el conteo de ciclos ocultos, para que sea
            // reconocible de un vistazo entre los 2 controles de expandir.
            className="inline-flex items-center gap-1 rounded-full border border-verde-institucional/30 bg-verde-claro/60 px-2 py-1 text-verde-oscuro transition-colors hover:bg-verde-claro"
          >
            {expandida ? (
              <ChevronUp size={13} strokeWidth={2.5} />
            ) : (
              <Layers size={13} strokeWidth={2.5} />
            )}
            <span className="font-data text-[0.6875rem] font-semibold">+{extra}</span>
          </button>
        )
      },
    }),
  ]
}
