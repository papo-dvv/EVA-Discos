import { useEffect, useState } from 'react'
import { SegmentedControl } from '../components/SegmentedControl'
import { useSemaforoMediciones } from '../features/scan-records/queries'
import { MedicionesConfirmadas } from './MedicionesConfirmadas'
import { MedicionesTarjetas } from './MedicionesTarjetas'

const CLAVE_VISTA = 'eva.mediciones.vista'
type Vista = 'tarjetas' | 'tabla'

const OPCIONES_VISTA: { valor: Vista; etiqueta: string }[] = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas' },
  { valor: 'tabla', etiqueta: 'Tabla' },
]

// Punto de entrada del módulo Mediciones — header compartido + toggle de
// vista (Tarjetas por defecto, calcada de EVA-Aldy; Tabla es la vista por
// fila que EVA ya tenía, sin cambios, ver MedicionesConfirmadas.tsx). El
// header vive en una franja aparte (no envuelve a las vistas hijas) porque
// cada una ya trae su propio ancho/padding — anidarlas duplicaría el padding.
export function Mediciones() {
  const [vista, setVista] = useState<Vista>(() => {
    const guardada = localStorage.getItem(CLAVE_VISTA)
    return guardada === 'tabla' ? 'tabla' : 'tarjetas'
  })
  const semaforo = useSemaforoMediciones()

  useEffect(() => {
    localStorage.setItem(CLAVE_VISTA, vista)
  }, [vista])

  return (
    <>
      <div className="px-3 pt-6 sm:px-5">
        <div className="mx-auto flex max-w-[112.5rem] flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
            <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Mediciones</h1>
            <p className="mt-1 font-body text-sm text-concreto">
              {semaforo.data ? semaforo.data.length : '—'} trenes · ordenados por criticidad
            </p>
          </div>
          <SegmentedControl
            ariaLabel="Vista de Mediciones"
            opciones={OPCIONES_VISTA}
            valor={vista}
            onCambiar={(v) => setVista(v)}
          />
        </div>
      </div>

      {vista === 'tarjetas' ? <MedicionesTarjetas /> : <MedicionesConfirmadas />}
    </>
  )
}
