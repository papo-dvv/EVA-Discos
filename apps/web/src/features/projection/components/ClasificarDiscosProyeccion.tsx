import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { PaginacionNumerica } from '../../scan-records/components/PaginacionNumerica'
import { ESTADO_META } from '../../fleet/components/estadoVisual'
import { fabricanteDeTren } from '../../fleet/components/fabricante'
import { ICONO_ESTADO_TREN } from '../../fleet/components/semaforoTren'
import { useFleetSummary } from '../../fleet/queries'
import type { EstadoDisco } from '../../scan-records/types'
import { PanelFiltrosProyeccion } from './PanelFiltrosProyeccion'
import { TablaProyeccion } from './TablaProyeccion'
import {
  aplicarFiltrosProyeccion,
  contarFiltrosActivosProyeccion,
  FILTROS_VACIOS_PROYECCION,
  type FiltrosStateProyeccion,
} from '../filtros'
import { useProyeccionDiscos } from '../queries'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'

const PAGE_SIZE = 25
const ESTADOS: EstadoDisco[] = ['CRITICO', 'CAMBIO', 'REPERFILADO', 'SEGUIMIENTO', 'OK']

function StatCard({ estado, total }: { readonly estado: EstadoDisco; readonly total: number }) {
  const meta = ESTADO_META[estado]
  const Icono = ICONO_ESTADO_TREN[estado]
  return (
    <GlassSurface fuerte className="rounded-glass border-l-4 p-3" style={{ borderLeftColor: meta.cssVar }}>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${meta.cssVar} 15%, transparent)` }}
      >
        <Icono size={15} style={{ color: meta.cssVar }} aria-hidden />
      </span>
      <p className="mt-2 font-data text-xl font-bold text-concreto-oscuro">{total}</p>
      <p className="font-body text-xs text-concreto">{meta.etiqueta}</p>
    </GlassSurface>
  )
}

// Solo lectura: conteo fleet-wide por estado (5 stat cards) + la misma tabla
// filtrable de Proyección (fleet-wide, sin sidebar de trenes — a diferencia
// de ProyeccionTabla.tsx). Sin edición ni persistencia — a diferencia de
// ClasificarRuedasTab de EVA-Aldy, que sí permite clasificar y guardar
// decisiones del analista.
export function ClasificarDiscosProyeccion() {
  const fleet = useFleetSummary()
  const [page, setPage] = useState(1)
  const [filtros, setFiltros] = useState<FiltrosStateProyeccion>(FILTROS_VACIOS_PROYECCION)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const params = useMemo(
    () => aplicarFiltrosProyeccion({ page, pageSize: PAGE_SIZE }, filtros),
    [page, filtros],
  )
  const discos = useProyeccionDiscos(params)
  const filtrosActivos = contarFiltrosActivosProyeccion(filtros)

  const conteo = useMemo(() => {
    const acumulado: Record<EstadoDisco, number> = { OK: 0, SEGUIMIENTO: 0, CAMBIO: 0, CRITICO: 0, REPERFILADO: 0 }
    // Solo Alstom (ver ResumenAnalisisProyeccion) — useFleetSummary() es
    // fleet-wide, pero esta pantalla es exclusivamente Proyección/Alstom.
    for (const t of (fleet.data ?? []).filter((t) => fabricanteDeTren(t.tren) === 'ALSTOM')) {
      acumulado.OK += t.conteoEstado.ok
      acumulado.SEGUIMIENTO += t.conteoEstado.seguimiento
      acumulado.CAMBIO += t.conteoEstado.cambio
      acumulado.CRITICO += t.conteoEstado.critico
      acumulado.REPERFILADO += t.conteoEstado.reperfilado
    }
    return acumulado
  }, [fleet.data])

  function cambiarFiltros(patch: Partial<FiltrosStateProyeccion>) {
    setFiltros((f) => ({ ...f, ...patch }))
    setPage(1)
  }
  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS_PROYECCION)
    setPage(1)
  }

  const totalPaginas = discos.data?.totalPaginas ?? discos.data?.totalPages ?? 1

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ESTADOS.map((estado) => (
          <StatCard key={estado} estado={estado} total={fleet.isLoading ? 0 : conteo[estado]} />
        ))}
      </div>

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
        <TablaProyeccion rows={discos.data?.rows ?? []} mostrarColumnaTren />
      )}

      <div className="mt-4">
        <PaginacionNumerica page={page} totalPaginas={totalPaginas} onPage={setPage} />
      </div>
    </div>
  )
}
