import { useSemaforoMediciones } from '../features/scan-records/queries'
import { MedicionesTarjetas } from './MedicionesTarjetas'

// Punto de entrada del módulo Mediciones — antes tenía un toggle
// Tarjetas/Tabla; la vista de Tabla se mudó a Configuración (ver
// MedicionesTabla.tsx) porque es una herramienta de detalle, no la vista
// operativa del día a día. Acá solo queda Tarjetas (calcada de EVA-Aldy).
export function Mediciones() {
  const semaforo = useSemaforoMediciones()

  return (
    <>
      <div className="px-3 pt-6 sm:px-5">
        <div className="mx-auto flex max-w-[112.5rem] flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
            <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Mediciones</h1>
            <p className="mt-1 font-body text-sm text-concreto">
              {semaforo.data ? semaforo.data.trenes.length : '—'} trenes · ordenados por criticidad
            </p>
          </div>
        </div>
      </div>

      <MedicionesTarjetas />
    </>
  )
}
