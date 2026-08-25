import { AlertTriangle, CheckCircle2, Eye, XCircle, type LucideIcon } from 'lucide-react'
import type { EstadoSemaforoMediciones } from '../types'

// Reusa la misma escalera de color verde→ámbar→naranja→rojo que
// --color-estado-* (tokens.css), aunque las etiquetas no coincidan 1:1 con
// las de EstadoDisco — son dos taxonomías distintas (esta es por DÍAS SIN
// MEDIR, no por Rd/H) que comparten el mismo lenguaje visual de severidad.
// Umbrales configurables en Configuración (dias_semaforo_*).
export const SEMAFORO_MEDICIONES_META: Record<
  EstadoSemaforoMediciones,
  { etiqueta: string; rango: string; cssVar: string; Icono: LucideIcon }
> = {
  NORMAL: { etiqueta: 'Normal', rango: '0 – 15 días', cssVar: 'var(--color-estado-ok)', Icono: CheckCircle2 },
  ALERTA: { etiqueta: 'Alerta', rango: '16 – 25 días', cssVar: 'var(--color-estado-seguimiento)', Icono: Eye },
  CRITICO: { etiqueta: 'Crítico', rango: '26 – 30 días', cssVar: 'var(--color-estado-cambio)', Icono: AlertTriangle },
  PRIORIDAD: { etiqueta: 'Prioridad', rango: '31 – 89+ días', cssVar: 'var(--color-estado-critico)', Icono: XCircle },
}

export const ORDEN_SEMAFORO_MEDICIONES: EstadoSemaforoMediciones[] = ['NORMAL', 'ALERTA', 'CRITICO', 'PRIORIDAD']
