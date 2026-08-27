import { GlassSurface } from '../../../components/GlassSurface'
import { ORDEN_SEMAFORO_MEDICIONES, SEMAFORO_MEDICIONES_META } from './semaforoMedicionesVisual'

// Leyenda del semáforo "días sin medir" de las tarjetas de Mediciones —
// mismos umbrales que dias_semaforo_alerta/critico/prioridad, ver
// Configuración para editarlos.
export function LeyendaSemaforoMediciones() {
  return (
    <GlassSurface fuerte className="rounded-glass px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
          Semáforo
        </span>
        {ORDEN_SEMAFORO_MEDICIONES.map((estado) => {
          const meta = SEMAFORO_MEDICIONES_META[estado]
          return (
            <span key={estado} className="flex items-center gap-1.5 font-body text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_6px_currentColor]"
                style={{ backgroundColor: meta.cssVar, color: meta.cssVar }}
                aria-hidden
              />
              <span className="font-semibold text-concreto-oscuro">{meta.etiqueta}</span>
              <span className="text-concreto">— {meta.rango}</span>
            </span>
          )
        })}
      </div>
    </GlassSurface>
  )
}
