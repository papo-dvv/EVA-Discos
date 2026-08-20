import type { SortingState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { CardFormulas } from '../components/CardFormulas'
import { GlassSurface } from '../components/GlassSurface'
import { PaginacionNumerica } from '../features/scan-records/components/PaginacionNumerica'
import { SidebarTrenes } from '../features/scan-records/components/SidebarTrenes'
import { useScanRecordsOpcionesFiltro, useScanRecordsResumenPorTren } from '../features/scan-records/queries'
import { PanelParametros } from '../features/system-params/components/PanelParametros'
import { GraficoTasaMensual } from '../features/wear-rate/components/GraficoTasaMensual'
import { PanelFiltrosWearRate } from '../features/wear-rate/components/PanelFiltrosWearRate'
import { PanelResumenWearRate } from '../features/wear-rate/components/PanelResumenWearRate'
import { TablaWearRate } from '../features/wear-rate/components/TablaWearRate'
import { FILTROS_VACIOS_WEAR_RATE, aplicarFiltrosWearRate, contarFiltrosActivosWearRate, type FiltrosStateWearRate } from '../features/wear-rate/filtros'
import { useWearRateChart, useWearRatePairs, useWearRateSummary } from '../features/wear-rate/queries'
import type { ColumnaOrdenableWearRate } from '../features/wear-rate/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PAGE_SIZE = 25
type Modo = 'global' | 'tren'
const MODOS: { valor: Modo; etiqueta: string }[] = [
  { valor: 'global', etiqueta: 'Global' },
  { valor: 'tren', etiqueta: 'Por tren' },
]

// Pantalla de tasa de desgaste: reusa el sidebar de trenes, la tabla y el
// panel de parámetros ya construidos para /mediciones. El toggle Global/Por
// tren decide si el disc_id agrega toda la flota o se acota a un tren — el
// sidebar (con su propia opción "Todos") solo se activa en modo "Por tren";
// en "Global" queda oculto y el parámetro `tren` nunca viaja al backend.
export function TasaDesgaste() {
  const [modo, setModo] = useState<Modo>('global')
  const [trenSeleccionado, setTrenSeleccionado] = useState<number | null>(null)
  // Vacío = sin sortBy/sortDir explícito: la carga inicial deja que el
  // backend aplique su orden físico jerárquico por defecto. Solo se puebla
  // tras un click explícito en un encabezado ordenable de TablaWearRate.
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)
  const [filtros, setFiltros] = useState<FiltrosStateWearRate>(FILTROS_VACIOS_WEAR_RATE)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const trenEfectivo = modo === 'tren' ? (trenSeleccionado ?? undefined) : undefined

  const orden = sorting[0]
  // Filtros SOLO para la tabla paginada — el gráfico y el resumen (más
  // abajo) usan sus propios hooks, que solo dependen de `tren` y nunca de
  // `filtros`, así que jamás se refetchean al cambiar un filtro de la tabla.
  const params = useMemo(
    () =>
      aplicarFiltrosWearRate(
        {
          tren: trenEfectivo,
          page,
          pageSize: PAGE_SIZE,
          ...(orden
            ? {
                sortBy: orden.id as ColumnaOrdenableWearRate,
                sortDir: (orden.desc ? 'desc' : 'asc') as 'asc' | 'desc',
              }
            : {}),
        },
        filtros,
      ),
    [trenEfectivo, page, orden, filtros],
  )

  // Mismo catálogo de trenes-con-datos que /mediciones: no hay (ni hace
  // falta) un resumen-por-tren propio de wear-rate solo para poblar la lista
  // del sidebar — los trenes con mediciones confirmadas son el mismo universo.
  const resumenTrenes = useScanRecordsResumenPorTren({})
  // Mismo catálogo de tipos de coche/bogie que /mediciones (misma flota).
  const opciones = useScanRecordsOpcionesFiltro({})
  const pares = useWearRatePairs(params)
  const chart = useWearRateChart(trenEfectivo)
  const resumen = useWearRateSummary(trenEfectivo)

  const filtrosActivos = contarFiltrosActivosWearRate(filtros)

  function cambiarModo(m: Modo) {
    setModo(m)
    setPage(1)
  }
  function seleccionarTren(t: number | null) {
    setTrenSeleccionado(t)
    setPage(1)
  }
  function cambiarFiltros(patch: Partial<FiltrosStateWearRate>) {
    setFiltros((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS_WEAR_RATE)
    setPage(1)
  }

  const totalPaginas = pares.data?.totalPaginas ?? pares.data?.totalPages ?? 1
  const etiquetaAlcance =
    modo === 'global' ? 'Toda la flota' : trenSeleccionado !== null ? `Tren ${trenSeleccionado}` : 'Todos los trenes'

  return (
    <div className="px-3 py-6 sm:px-5">
      <div className="mx-auto flex max-w-[112.5rem] items-start gap-5">
        {modo === 'tren' && (
          <SidebarTrenes
            resumen={resumenTrenes.data ?? []}
            cargando={resumenTrenes.isLoading}
            trenSeleccionado={trenSeleccionado}
            onSeleccionar={seleccionarTren}
          />
        )}

        <main className="min-w-0 flex-1">
          {/* Barra glass: título + toggle Global/Por tren */}
          <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
                Tasa de desgaste
              </h1>
              <p className="mt-0.5 font-body text-sm text-concreto">
                {etiquetaAlcance} · <span className="font-data">{pares.data?.total ?? 0}</span> pares
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="eva-segmento" role="group" aria-label="Alcance de los datos">
                {MODOS.map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    className="eva-segmento__opcion"
                    data-active={modo === m.valor ? 'true' : undefined}
                    onClick={() => cambiarModo(m.valor)}
                  >
                    {m.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          </GlassSurface>

          {/* Resumen + parámetros arriba de la tabla en pantallas sin columna derecha */}
          <div className="mt-4 space-y-4 xl:hidden">
            <PanelResumenWearRate resumen={resumen.data} cargando={resumen.isLoading} />
            <CardFormulas variante="tasaDesgaste" />
            <PanelParametros modulo="tasa-desgaste" />
          </div>

          <GraficoTasaMensual puntos={chart.data ?? []} cargando={chart.isLoading} titulo={etiquetaAlcance} />

          {/* Toggle de filtros — solo afectan la tabla, nunca el gráfico ni el resumen */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
            <p className="font-body text-xs text-concreto">Estos filtros no afectan el gráfico ni el resumen.</p>
          </div>

          {filtrosAbiertos && (
            <GlassSurface fuerte className="mt-3 rounded-glass p-5">
              <PanelFiltrosWearRate
                filtros={filtros}
                onCambiar={cambiarFiltros}
                onLimpiar={limpiarFiltros}
                opciones={opciones.data}
              />
            </GlassSurface>
          )}

          {pares.isLoading ? (
            <p className="mt-6 font-body text-sm text-concreto">Cargando…</p>
          ) : pares.isError ? (
            <p role="alert" className="mt-6 font-body text-sm text-[color:var(--color-estado-critico)]">
              {extraerMensajeError(pares.error)}
            </p>
          ) : (
            <TablaWearRate
              rows={pares.data?.rows ?? []}
              sorting={sorting}
              onSortingChange={setSorting}
              mostrarColumnaTren={trenEfectivo === undefined}
            />
          )}

          <div className="mt-4">
            <PaginacionNumerica page={page} totalPaginas={totalPaginas} onPage={setPage} />
          </div>
        </main>

        {/* Columna derecha: resumen + parámetros (desde xl) */}
        <aside className="hidden w-[21.25rem] flex-shrink-0 xl:block">
          <div className="sticky top-6 space-y-4">
            <PanelResumenWearRate resumen={resumen.data} cargando={resumen.isLoading} />
            <CardFormulas variante="tasaDesgaste" />
            <PanelParametros modulo="tasa-desgaste" />
          </div>
        </aside>
      </div>
    </div>
  )
}
