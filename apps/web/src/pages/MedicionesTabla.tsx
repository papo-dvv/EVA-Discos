import { ClipboardList } from 'lucide-react'
import { MedicionesConfirmadas } from './MedicionesConfirmadas'

// Tabla de Mediciones — se mudó acá desde el toggle de vista de
// Mediciones.tsx (que ahora solo muestra Tarjetas) por el mismo motivo que
// la tabla de Proyección: herramienta de detalle fila-por-fila, no la vista
// operativa del día a día.
export function MedicionesTabla() {
  return (
    <div>
      <div className="px-3 pt-6 sm:px-5">
        <div className="mx-auto max-w-[112.5rem] pb-2">
          <p className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">
            <ClipboardList size={13} aria-hidden /> Mediciones
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
            Tabla de mediciones
          </h1>
        </div>
      </div>
      <MedicionesConfirmadas />
    </div>
  )
}
