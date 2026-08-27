import { useMemo, useState } from 'react'
import { CardFormulas } from '../components/CardFormulas'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { EstadoActualizacionModulo } from '../features/module-snapshot/components/EstadoActualizacionModulo'
import { PaginacionNumerica } from '../features/scan-records/components/PaginacionNumerica'
import { SidebarTrenes } from '../features/scan-records/components/SidebarTrenes'
import { useScanRecordsResumenPorTren } from '../features/scan-records/queries'
import { PanelFiltrosProyeccion } from '../features/projection/components/PanelFiltrosProyeccion'
import { PanelPromedioPorVagon } from '../features/projection/components/PanelPromedioPorVagon'
import { ProyeccionGraficoBarras } from '../features/projection/components/ProyeccionGraficoBarras'
import { TablaProyeccion } from '../features/projection/components/TablaProyeccion'
import {
  aplicarFiltrosProyeccion,
  contarFiltrosActivosProyeccion,
  FILTROS_VACIOS_PROYECCION,
  type FiltrosStateProyeccion,
} from '../features/projection/filtros'
import { usePromedioPorVagon, useProyeccionDiscos } from '../features/projection/queries'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PAGE_SIZE = 25
type Modo = 'global' | 'tren'
const MODOS: { valor: Modo; etiqueta: string }[] = [
  { valor: 'global', etiqueta: 'Global' },
  { valor: 'tren', etiqueta: 'Por tren' },
]

type Tab = 'barras' | 'tabla'
const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: 'barras', etiqueta: 'Gráfico de Barras' },
  { valor: 'tabla', etiqueta: 'Tabla' },
]

// Proyección de Reperfilado y Cambio: toggle de página Gráfico de Barras |
// Tabla. "Gráfico de Barras" (ProyeccionGraficoBarras) es siempre fleet-wide
// — el alcance Global/Por tren + sidebar de trenes (mismo patrón que Tasa de
// Desgaste, ver TasaDesgaste.tsx) vive solo dentro de "Tabla", junto con la
// tabla principal, filtros, promedio por vagón y fórmulas.
export function Proyeccion() {
  const [tab, setTab] = useState<Tab>('barras')
  const [modo, setModo] = useState<Modo>('global')
  const [trenSeleccionado, setTrenSeleccionado] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [filtros, setFiltros] = useState<FiltrosStateProyeccion>(FILTROS_VACIOS_PROYECCION)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const trenEfectivo = modo === 'tren' ? (trenSeleccionado ?? undefined) : undefined

  const params = useMemo(
    () => aplicarFiltrosProyeccion({ tren: trenEfectivo, page, pageSize: PAGE_SIZE }, filtros),
    [trenEfectivo, page, filtros],
  )

  // Mismo catálogo de trenes-con-datos que /mediciones y Tasa de Desgaste.
  const resumenTrenes = useScanRecordsResumenPorTren({})
  const discos = useProyeccionDiscos(params)
  const promedioPorVagon = usePromedioPorVagon()

  const filtrosActivos = contarFiltrosActivosProyeccion(filtros)

  function cambiarModo(m: Modo) {
    setModo(m)
    setPage(1)
  }
  function seleccionarTren(t: number | null) {
    setTrenSeleccionado(t)
    setPage(1)
  }
  function cambiarFiltros(patch: Partial<FiltrosStateProyeccion>) {
    setFiltros((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS_PROYECCION)
    setPage(1)
  }

  const totalPaginas = discos.data?.totalPaginas ?? discos.data?.totalPages ?? 1
  const etiquetaAlcance =
    modo === 'global' ? 'Toda la flota' : trenSeleccionado !== null ? `Tren ${trenSeleccionado}` : 'Todos los trenes'

  return (
    <div className="px-3 py-6 sm:px-5">
      <div className="mx-auto flex max-w-[112.5rem] items-start gap-5">
        {tab === 'tabla' && modo === 'tren' && (
          <SidebarTrenes
            resumen={resumenTrenes.data ?? []}
            cargando={resumenTrenes.isLoading}
            trenSeleccionado={trenSeleccionado}
            onSeleccionar={seleccionarTren}
          />
        )}

        <main className="min-w-0 flex-1">
          {/* Barra glass: título + toggle de pestaña Gráfico de Barras/Tabla */}
          <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
              Proyección de reperfilado y cambio
            </h1>

            <div className="flex flex-wrap items-center gap-4">
              <SegmentedControl
                ariaLabel="Vista de Proyección"
                opciones={TABS.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                valor={tab}
                onCambiar={setTab}
              />
              <EstadoActualizacionModulo modulo="proyeccion" />
            </div>
          </GlassSurface>

          {tab === 'barras' && <ProyeccionGraficoBarras />}

          {tab === 'tabla' && (
            <>
              {/* Alcance de datos + toggle Global/Por tren */}
              <GlassSurface className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
                <p className="font-body text-sm text-concreto">
                  {etiquetaAlcance} · <span className="font-data">{discos.data?.total ?? 0}</span> discos
                </p>
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
              </GlassSurface>

              {/* Promedio por vagón + fórmulas arriba de la tabla en pantallas sin columna derecha */}
              <div className="mt-4 space-y-4 xl:hidden">
                <PanelPromedioPorVagon datos={promedioPorVagon.data} cargando={promedioPorVagon.isLoading} />
                <CardFormulas variante="proyeccion" />
              </div>

              {/* Toggle de filtros — solo afectan la tabla principal */}
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
                <p className="font-body text-xs text-concreto">
                  Estos filtros no afectan el promedio por vagón.
                </p>
              </div>

              {filtrosAbiertos && (
                <GlassSurface fuerte className="mt-3 rounded-glass p-5">
                  <PanelFiltrosProyeccion filtros={filtros} onCambiar={cambiarFiltros} onLimpiar={limpiarFiltros} />
                </GlassSurface>
              )}

              {discos.isLoading ? (
                <p className="mt-6 font-body text-sm text-concreto">Cargando…</p>
              ) : discos.isError ? (
                <p role="alert" className="mt-6 font-body text-sm text-[color:var(--color-estado-critico)]">
                  {extraerMensajeError(discos.error)}
                </p>
              ) : (
                <TablaProyeccion rows={discos.data?.rows ?? []} mostrarColumnaTren={trenEfectivo === undefined} />
              )}

              <div className="mt-4">
                <PaginacionNumerica page={page} totalPaginas={totalPaginas} onPage={setPage} />
              </div>
            </>
          )}
        </main>

        {/* Columna derecha: promedio por vagón + fórmulas (desde xl) — solo en la pestaña Tabla */}
        {tab === 'tabla' && (
          <aside className="hidden w-[21.25rem] flex-shrink-0 xl:block">
            <div className="sticky top-6 space-y-4">
              <PanelPromedioPorVagon datos={promedioPorVagon.data} cargando={promedioPorVagon.isLoading} />
              <CardFormulas variante="proyeccion" />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
