import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassSelect } from '../components/GlassSelect'
import { SegmentedControl } from '../components/SegmentedControl'
import { fabricanteDeTren, type FabricanteTren } from '../features/fleet/components/fabricante'
import { ModalCargaInicialMedicion } from '../features/new-measurement/components/ModalCargaInicialMedicion'
import { LeyendaSemaforoMediciones } from '../features/scan-records/components/LeyendaSemaforoMediciones'
import { TrenSemaforoCard } from '../features/scan-records/components/TrenSemaforoCard'
import { useSemaforoMediciones } from '../features/scan-records/queries'
import type { SemaforoTrenMediciones } from '../features/scan-records/types'

type FiltroFabricante = 'todos' | FabricanteTren

const FILTROS_FABRICANTE: { valor: FiltroFabricante; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'ALSTOM', etiqueta: 'Alstom' },
  { valor: 'ANSALDO', etiqueta: 'Ansaldo' },
]

type CriterioOrden = 'prioridad' | 'numerico'
type DireccionOrden = 'asc' | 'desc'

const OPCIONES_CRITERIO_ORDEN: { valor: CriterioOrden; etiqueta: string }[] = [
  { valor: 'prioridad', etiqueta: 'Prioridad' },
  { valor: 'numerico', etiqueta: 'Orden numérico' },
]

const OPCIONES_DIRECCION_ORDEN: { valor: DireccionOrden; etiqueta: string }[] = [
  { valor: 'desc', etiqueta: 'Descendente' },
  { valor: 'asc', etiqueta: 'Ascendente' },
]

// 'prioridad' = días sin medir (mismo criterio que el semáforo de color:
// más días sin medir = más urgente). Un tren SIN ninguna medición todavía
// (diasSinMedir null) es el caso más urgente posible — se trata como
// Infinity, igual que el sort por defecto que tenía esta pantalla antes de
// este combo.
function compararPorPrioridad(a: SemaforoTrenMediciones, b: SemaforoTrenMediciones): number {
  return (a.diasSinMedir ?? Infinity) - (b.diasSinMedir ?? Infinity)
}

function compararPorNumero(a: SemaforoTrenMediciones, b: SemaforoTrenMediciones): number {
  return a.tren - b.tren
}

// Vista "Tarjetas" de Mediciones — calcada de EVA-Aldy (MedicionesListPage),
// ver styles-eva. Usa el semáforo "días sin medir" por tren (backend:
// GET /scan-records/semaforo-mediciones), NO la vista por fila de la Tabla.
export function MedicionesTarjetas() {
  const semaforo = useSemaforoMediciones()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [fabricante, setFabricante] = useState<FiltroFabricante>('todos')
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>('prioridad')
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc')
  // Modal de carga inicial (CSV/Manual) abierto desde una card puntual — ver
  // TrenSemaforoCard.onAbrirCarga/ModalCargaInicialMedicion. null = cerrado.
  const [cargaAbierta, setCargaAbierta] = useState<{
    tren: number
    modo: 'csv' | 'manual'
  } | null>(null)

  const filtrados = useMemo(() => {
    const trimmed = busqueda.trim()
    const comparar = criterioOrden === 'prioridad' ? compararPorPrioridad : compararPorNumero
    const signo = direccionOrden === 'asc' ? 1 : -1
    return (semaforo.data ?? [])
      .filter((tren) => {
        if (fabricante !== 'todos' && fabricanteDeTren(tren.tren) !== fabricante) return false
        if (trimmed && !String(tren.tren).includes(trimmed)) return false
        return true
      })
      .sort((a, b) => signo * comparar(a, b))
  }, [semaforo.data, busqueda, fabricante, criterioOrden, direccionOrden])

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
        <GlassSelect
          label="Ordenar por"
          opciones={OPCIONES_CRITERIO_ORDEN}
          seleccion={criterioOrden}
          onCambiar={(v) => setCriterioOrden((v as CriterioOrden) ?? 'prioridad')}
          className="w-full sm:w-48"
        />
        <SegmentedControl
          ariaLabel="Dirección del orden"
          opciones={OPCIONES_DIRECCION_ORDEN}
          valor={direccionOrden}
          onCambiar={(v) => setDireccionOrden(v)}
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
            <TrenSemaforoCard
              key={tren.tren}
              tren={tren}
              onAbrirCarga={(modo) => setCargaAbierta({ tren: tren.tren, modo })}
            />
          ))}
        </div>
      )}
      </div>

      {cargaAbierta && (
        <ModalCargaInicialMedicion
          tren={cargaAbierta.tren}
          modoInicial={cargaAbierta.modo}
          onCerrar={() => setCargaAbierta(null)}
          onCreada={(fichaId, autoVerificar) => {
            setCargaAbierta(null)
            navigate(`/nuevas-mediciones/${fichaId}`, {
              state: autoVerificar ? { autoVerificar: true } : undefined,
            })
          }}
        />
      )}
    </div>
  )
}
