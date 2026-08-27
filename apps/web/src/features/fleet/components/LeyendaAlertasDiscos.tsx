import { GlassSurface } from '../../../components/GlassSurface'
import { ESTADO_META } from './estadoVisual'
import type { EstadoDisco } from '../../scan-records/types'

const DESCRIPCION_CORTA: Record<EstadoDisco, string> = {
  OK: 'sin alertas',
  SEGUIMIENTO: 'observar',
  CAMBIO: 'programar cambio',
  CRITICO: 'cambio inmediato',
  REPERFILADO: 'reperfilar disco',
}

const ORDEN: EstadoDisco[] = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO']

// Leyenda breve del semáforo de discos — calcada de AlertasLeyenda (variant
// compact) de EVA-Aldy, ver styles-eva/flota-styles.md, pero con los 5
// estados propios de EVA (ESTADO_META) en vez de los 4 de Aldy.
export function LeyendaAlertasDiscos() {
  return (
    <GlassSurface fuerte className="rounded-glass px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-concreto">
          Alertas de discos
        </span>
        {ORDEN.map((estado) => (
          <span key={estado} className="flex items-center gap-1.5 font-body text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_6px_currentColor]"
              style={{ backgroundColor: ESTADO_META[estado].cssVar, color: ESTADO_META[estado].cssVar }}
              aria-hidden
            />
            <span className="font-semibold text-concreto-oscuro">{ESTADO_META[estado].etiqueta}</span>
            <span className="text-concreto">— {DESCRIPCION_CORTA[estado]}</span>
          </span>
        ))}
      </div>
    </GlassSurface>
  )
}
