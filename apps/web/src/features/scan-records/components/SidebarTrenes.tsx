import { GlassSurface } from '../../../components/GlassSurface'
import { VirtualList } from '../../../components/VirtualList'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { ResumenTren } from '../types'

// Pseudo-tren "Reserva" (ver schema.prisma, Train.numero=0): unidades
// Ansaldo sin tren real asignado (hoja "UDT RESERVA" del Excel).
function etiquetaTren(tren: number): string {
  return tren === 0 ? 'Reserva' : `Tren ${tren}`
}

// Sidebar de trenes (panel glass, lista virtualizada con scrollbar propio) —
// compartido entre la vista previa de una migración en curso y la vista
// permanente de confirmados. `onEliminarTren` es OPCIONAL: si no se pasa
// (no hay equivalente de "borrar todo un tren" para datos ya confirmados),
// el tacho de esa fila directamente no se renderiza.
type Props = {
  resumen: ResumenTren[]
  cargando: boolean
  trenSeleccionado: number | null
  onSeleccionar: (tren: number | null) => void
  onEliminarTren?: (t: ResumenTren) => void
  deshabilitado?: boolean
}

export function SidebarTrenes({
  resumen,
  cargando,
  trenSeleccionado,
  onSeleccionar,
  onEliminarTren,
  deshabilitado,
}: Props) {
  const altoLista = Math.min(Math.max(resumen.length, 1) * 46, 560)

  return (
    <GlassSurface className="sticky top-6 hidden w-[16.5rem] flex-shrink-0 rounded-glass p-4 lg:block">
      <h2 className="mb-3 px-1 font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
        Trenes
      </h2>
      <button
        type="button"
        onClick={() => onSeleccionar(null)}
        className={`mb-1 block w-full rounded-2xl px-3 py-2 text-left font-body text-sm transition-colors ${
          trenSeleccionado === null
            ? 'bg-verde-claro font-semibold text-verde-oscuro'
            : 'text-concreto-oscuro hover:bg-white/50'
        }`}
      >
        Todos
      </button>
      {cargando && <p className="px-1 font-body text-sm text-concreto">Cargando…</p>}
      {resumen.length > 0 && (
        <VirtualList
          items={resumen}
          alto={altoLista}
          estimateSize={46}
          getKey={(t) => t.tren}
          ariaLabel="Trenes"
          renderItem={(t) => (
            <div className="flex items-center gap-1 py-0.5 pr-1">
              <button
                type="button"
                onClick={() => onSeleccionar(t.tren)}
                className={`flex flex-1 items-center gap-1.5 rounded-2xl px-3 py-2 text-left font-body text-sm transition-colors ${
                  trenSeleccionado === t.tren
                    ? 'bg-verde-claro font-semibold text-verde-oscuro'
                    : 'text-concreto-oscuro hover:bg-white/50'
                }`}
              >
                <span>{etiquetaTren(t.tren)}</span>
                <span className="font-data text-xs text-concreto">({t.totalFilas})</span>
                {t.filasConAdvertencia > 0 && (
                  <WarningTooltip
                    texto={`${t.filasConAdvertencia} fila(s) con advertencia`}
                    className="ml-auto"
                  >
                    <span aria-label="con advertencias">⚠️</span>
                  </WarningTooltip>
                )}
              </button>
              {onEliminarTren && (
                <button
                  type="button"
                  title={`Eliminar todas las filas de ${etiquetaTren(t.tren)}`}
                  onClick={() => onEliminarTren(t)}
                  disabled={deshabilitado}
                  className="rounded-full px-2 py-1 text-[color:var(--color-estado-critico)] transition-colors hover:bg-white/50 disabled:opacity-40"
                >
                  🗑
                </button>
              )}
            </div>
          )}
        />
      )}
    </GlassSurface>
  )
}
