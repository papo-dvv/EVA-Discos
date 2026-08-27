import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SegmentedControl } from '../components/SegmentedControl'
import { fabricanteDeTren, type FabricanteTren } from '../features/fleet/components/fabricante'
import { LeyendaSemaforoMediciones } from '../features/scan-records/components/LeyendaSemaforoMediciones'
import { TrenSemaforoCard } from '../features/scan-records/components/TrenSemaforoCard'
import { useSemaforoMediciones } from '../features/scan-records/queries'

type FiltroFabricante = 'todos' | FabricanteTren

const FILTROS_FABRICANTE: { valor: FiltroFabricante; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'ALSTOM', etiqueta: 'Alstom' },
  { valor: 'ANSALDO', etiqueta: 'Ansaldo' },
]

// Vista "Tarjetas" de Mediciones — calcada de EVA-Aldy (MedicionesListPage),
// ver styles-eva. Usa el semáforo "días sin medir" por tren (backend:
// GET /scan-records/semaforo-mediciones), NO la vista por fila de la Tabla.
export function MedicionesTarjetas() {
  const semaforo = useSemaforoMediciones()
  const [busqueda, setBusqueda] = useState('')
  const [fabricante, setFabricante] = useState<FiltroFabricante>('todos')

  const filtrados = useMemo(() => {
    const trimmed = busqueda.trim()
    return (semaforo.data ?? [])
      .filter((tren) => {
        if (fabricante !== 'todos' && fabricanteDeTren(tren.tren) !== fabricante) return false
        if (trimmed && !String(tren.tren).includes(trimmed)) return false
        return true
      })
      .sort((a, b) => (b.diasSinMedir ?? Infinity) - (a.diasSinMedir ?? Infinity))
  }, [semaforo.data, busqueda, fabricante])

  return (
    <div className="px-3 pb-6 sm:px-5">
      <div className="mx-auto max-w-[112.5rem]">
      <div className="mb-4">
        <LeyendaSemaforoMediciones />
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="mediciones-busqueda-tren" className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Buscar por número de tren
          </label>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-concreto" />
            <input
              id="mediciones-busqueda-tren"
              type="search"
              inputMode="numeric"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Número de tren…"
              className="glass-field py-2.5 pl-9"
            />
          </div>
        </div>
        <SegmentedControl
          ariaLabel="Filtrar por fabricante"
          opciones={FILTROS_FABRICANTE}
          valor={fabricante}
          onCambiar={(v) => setFabricante(v)}
        />
      </div>

      {semaforo.isLoading && <p className="py-12 text-center font-body text-sm text-concreto">Cargando trenes…</p>}
      {semaforo.isError && (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar el semáforo de mediciones.
        </p>
      )}
      {semaforo.data && filtrados.length === 0 && (
        <p className="py-12 text-center font-body text-sm text-concreto">Sin coincidencias con los filtros actuales.</p>
      )}

      {filtrados.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((tren) => (
            <TrenSemaforoCard key={tren.tren} tren={tren} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
