import { useMemo } from 'react'
import { getEstadoDominanteTren } from '../../fleet/components/semaforoTren'
import { useFleetSummary } from '../../fleet/queries'
import { TrenCriticoCardProyeccion } from './TrenCriticoCardProyeccion'

// Lista fleet-wide de trenes con estado dominante Crítico o Cambio, ordenada
// por severidad — réplica adaptada de la pestaña "Trenes Críticos" de
// EVA-Aldy, pero usando getEstadoDominanteTren (ya existente en Flota) en vez
// de recalcular un semáforo propio.
export function TrenesCriticosProyeccion() {
  const fleet = useFleetSummary()

  const trenes = useMemo(() => {
    return (fleet.data ?? [])
      .filter((t) => t.conteoEstado.critico > 0 || t.conteoEstado.cambio > 0)
      .sort((a, b) => {
        const estadoA = getEstadoDominanteTren(a.conteoEstado)
        const estadoB = getEstadoDominanteTren(b.conteoEstado)
        if (estadoA === 'CRITICO' && estadoB !== 'CRITICO') return -1
        if (estadoB === 'CRITICO' && estadoA !== 'CRITICO') return 1
        return b.conteoEstado.critico + b.conteoEstado.cambio - (a.conteoEstado.critico + a.conteoEstado.cambio)
      })
  }, [fleet.data])

  if (fleet.isLoading) return <p className="font-body text-sm text-concreto">Cargando…</p>

  if (trenes.length === 0) {
    return <p className="font-body text-sm text-concreto">Sin trenes en estado Crítico o Cambio ahora.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {trenes.map((item) => (
        <TrenCriticoCardProyeccion key={item.tren} item={item} />
      ))}
    </div>
  )
}
