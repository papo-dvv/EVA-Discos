import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GlassSelect } from '../components/GlassSelect'
import { GlassSurface } from '../components/GlassSurface'
import { PantallaFondo } from '../components/PantallaFondo'
import { SegmentedControl } from '../components/SegmentedControl'
import { EstadoDatosInsuficientes } from '../features/traceability/components/EstadoDatosInsuficientes'
import { GraficoTrazabilidad } from '../features/traceability/components/GraficoTrazabilidad'
import { GraficoTrazabilidadLimpia } from '../features/traceability/components/GraficoTrazabilidadLimpia'
import { PanelEstadisticasTrazabilidad } from '../features/traceability/components/PanelEstadisticasTrazabilidad'
import { PanelMetodosTrazabilidad } from '../features/traceability/components/PanelMetodosTrazabilidad'
import { useTraceabilitySeries, useTraceabilitySummary } from '../features/traceability/queries'
import type { Periodo, TraceabilityScopeParams } from '../features/traceability/types'
import { useScanRecordsOpcionesFiltro, useScanRecordsResumenPorTren } from '../features/scan-records/queries'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const PERIODO_OPCIONES: { valor: Periodo; etiqueta: string }[] = [
  { valor: '3m', etiqueta: '3 meses' },
  { valor: '6m', etiqueta: '6 meses' },
  { valor: '12m', etiqueta: '12 meses' },
  { valor: '2a', etiqueta: '2 años' },
  { valor: 'todo', etiqueta: 'Todo' },
]

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  '3m': 'últimos 3 meses',
  '6m': 'últimos 6 meses',
  '12m': 'últimos 12 meses',
  '2a': 'últimos 2 años',
  todo: 'todo el histórico',
}

// "General / Por tren / Por modelo de vagón / Por bogie" no se implementa
// como un toggle excluyente (el propio pedido pide poder combinar
// dimensiones a la vez, ej. tren Y tipoCoche activos juntos — un toggle de
// modo único lo impediría). En cambio son 3 selectores independientes
// (Tren/Tipo de coche/Bogie), cada uno limpiable por separado; "General" es
// simplemente el estado con los 3 vacíos. Esta etiqueta resume el scope
// activo con el mismo vocabulario de los 4 "modos" pedidos.
function construirEtiquetaScope(scope: TraceabilityScopeParams): string {
  const partes: string[] = []
  if (scope.tren !== undefined) partes.push(`Tren ${scope.tren}`)
  if (scope.tipoCoche) partes.push(scope.tipoCoche)
  if (scope.bogieCodigo) partes.push(`Bogie ${scope.bogieCodigo}`)
  return partes.length === 0 ? 'General — toda la flota' : partes.join(' · ')
}

export function Trazabilidad() {
  const [scope, setScope] = useState<TraceabilityScopeParams>({})
  const [periodo, setPeriodo] = useState<Periodo>('6m')

  const resumenTrenes = useScanRecordsResumenPorTren({})
  const opcionesFiltro = useScanRecordsOpcionesFiltro({})

  // Gráfico 1 (Diagnóstico completo) SIEMPRE pide crudo explícito: es la
  // vista de auditoría punto-a-punto y no sabe consumir puntos agregados por
  // mes — nunca debe depender del default del backend (ver el comentario
  // homólogo en TraceabilityController).
  const seriesParamsDiagnostico = useMemo(
    () => ({ ...scope, periodo, agregacion: 'crudo' as const }),
    [scope, periodo],
  )
  // Gráfico 2 (Trazabilidad limpia) pide 'auto': con volumen alto se agrega
  // por mes (línea suave de baja densidad), con poco volumen se queda en
  // crudo (agregar un puñado de puntos perdería información). Es un query
  // separado del de arriba — mismo scope/periodo pero distinto `agregacion`,
  // por lo tanto distinta query key y distinta respuesta (ver
  // GraficoTrazabilidadLimpia).
  const seriesParamsLimpia = useMemo(
    () => ({ ...scope, periodo, agregacion: 'auto' as const }),
    [scope, periodo],
  )
  const summary = useTraceabilitySummary(scope)
  const seriesDiagnostico = useTraceabilitySeries(seriesParamsDiagnostico)
  const seriesLimpia = useTraceabilitySeries(seriesParamsLimpia)

  const opcionesTren = useMemo(
    () => (resumenTrenes.data ?? []).map((t) => ({ valor: String(t.tren), etiqueta: `Tren ${t.tren}` })),
    [resumenTrenes.data],
  )
  const opcionesTipoCoche = useMemo(
    () => (opcionesFiltro.data?.tiposCoche ?? []).map((t) => ({ valor: t, etiqueta: t })),
    [opcionesFiltro.data],
  )
  const opcionesBogie = useMemo(
    () => (opcionesFiltro.data?.bogies ?? []).map((b) => ({ valor: b, etiqueta: b })),
    [opcionesFiltro.data],
  )

  const hayScope = scope.tren !== undefined || !!scope.tipoCoche || !!scope.bogieCodigo
  const etiquetaScope = construirEtiquetaScope(scope)

  return (
    <PantallaFondo className="px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-[87.5rem]">
        {/* Barra glass: título + alcance actual */}
        <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">Trazabilidad</h1>
            <p className="mt-0.5 font-body text-sm text-concreto">{etiquetaScope}</p>
          </div>
          <Link
            to="/"
            className="font-body text-xs text-concreto underline underline-offset-2 transition-colors hover:text-concreto-oscuro"
          >
            ← Volver al inicio
          </Link>
        </GlassSurface>

        {/* Selector de scope: General/Por tren/Por modelo/Por bogie combinables */}
        <GlassSurface fuerte className="mt-4 rounded-glass p-5">
          <div className="flex flex-wrap items-end gap-3">
            <GlassSelect
              label="Tren"
              opciones={opcionesTren}
              seleccion={scope.tren !== undefined ? String(scope.tren) : undefined}
              onCambiar={(v) => setScope((s) => ({ ...s, tren: v ? Number(v) : undefined }))}
              className="w-40"
            />
            <GlassSelect
              label="Tipo de coche"
              opciones={opcionesTipoCoche}
              seleccion={scope.tipoCoche}
              onCambiar={(v) => setScope((s) => ({ ...s, tipoCoche: v }))}
              className="w-44"
            />
            <GlassSelect
              label="Bogie"
              opciones={opcionesBogie}
              seleccion={scope.bogieCodigo}
              onCambiar={(v) => setScope((s) => ({ ...s, bogieCodigo: v }))}
              className="w-40"
            />
            <button
              type="button"
              onClick={() => setScope({})}
              disabled={!hayScope}
              className="rounded-full border border-concreto/30 px-4 py-2.5 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60 disabled:opacity-40"
            >
              Limpiar scope
            </button>
            <p className="pb-2.5 font-body text-xs text-concreto">
              Combiná cualquier cantidad de dimensiones a la vez — vacío = toda la flota.
            </p>
          </div>
        </GlassSurface>

        {summary.isLoading || seriesDiagnostico.isLoading || seriesLimpia.isLoading ? (
          <p className="mt-6 font-body text-sm text-concreto">Cargando…</p>
        ) : summary.isError || seriesDiagnostico.isError || seriesLimpia.isError ? (
          <p role="alert" className="mt-6 font-body text-sm text-[color:var(--color-estado-critico)]">
            {extraerMensajeError(summary.error ?? seriesDiagnostico.error ?? seriesLimpia.error)}
          </p>
        ) : !summary.data || !seriesDiagnostico.data || !seriesLimpia.data ? null : summary.data.datosInsuficientes ||
          seriesDiagnostico.data.datosInsuficientes ||
          seriesLimpia.data.datosInsuficientes ? (
          <EstadoDatosInsuficientes conteo={summary.data.conteo} />
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_22rem]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  ariaLabel="Periodo mostrado en el gráfico"
                  opciones={PERIODO_OPCIONES}
                  valor={periodo}
                  onCambiar={setPeriodo}
                />
                <p className="font-body text-xs text-concreto">
                  El periodo solo ajusta el tramo del gráfico — es instantáneo, no recalcula los límites.
                </p>
              </div>

              {/* seriesDiagnostico siempre pide agregacion='crudo' (ver más
                  arriba), así que agregacionAplicada==='crudo' es siempre
                  cierto en la práctica — el chequeo existe para que TS
                  estreche `puntos` a la forma cruda sin un cast inseguro. */}
              {seriesDiagnostico.data.agregacionAplicada === 'crudo' && (
                <GraficoTrazabilidad
                  puntos={seriesDiagnostico.data.puntos}
                  gauss={seriesDiagnostico.data.gauss}
                  percentiles={seriesDiagnostico.data.percentiles}
                  tukey={seriesDiagnostico.data.tukey}
                  consenso={seriesDiagnostico.data.consenso}
                  actualizando={seriesDiagnostico.isFetching}
                  titulo={etiquetaScope}
                />
              )}

              <GraficoTrazabilidadLimpia
                resultado={seriesLimpia.data}
                actualizando={seriesLimpia.isFetching}
                titulo={etiquetaScope}
              />

              {/* Paneles apilados debajo del gráfico en pantallas sin columna derecha */}
              <div className="mt-4 space-y-4 xl:hidden">
                <PanelMetodosTrazabilidad
                  conteo={summary.data.conteo}
                  gauss={summary.data.gauss}
                  percentiles={summary.data.percentiles}
                  tukey={summary.data.tukey}
                  consenso={summary.data.consenso}
                />
                <PanelEstadisticasTrazabilidad
                  estadisticas={summary.data.estadisticas}
                  conteoTotalHistorico={seriesDiagnostico.data.conteoTotalHistorico}
                  conteoMostradoEnPeriodo={seriesDiagnostico.data.conteoMostradoEnPeriodo}
                  etiquetaPeriodo={ETIQUETA_PERIODO[periodo]}
                />
              </div>
            </div>

            {/* Columna derecha: métodos + estadísticas (desde xl) */}
            <aside className="hidden xl:block">
              <div className="sticky top-6 space-y-4">
                <PanelMetodosTrazabilidad
                  conteo={summary.data.conteo}
                  gauss={summary.data.gauss}
                  percentiles={summary.data.percentiles}
                  tukey={summary.data.tukey}
                  consenso={summary.data.consenso}
                />
                <PanelEstadisticasTrazabilidad
                  estadisticas={summary.data.estadisticas}
                  conteoTotalHistorico={seriesDiagnostico.data.conteoTotalHistorico}
                  conteoMostradoEnPeriodo={seriesDiagnostico.data.conteoMostradoEnPeriodo}
                  etiquetaPeriodo={ETIQUETA_PERIODO[periodo]}
                />
              </div>
            </aside>
          </div>
        )}
      </div>
    </PantallaFondo>
  )
}
