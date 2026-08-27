import { colorEstado } from '../../fleet/components/estadoVisual'
import type { LadoInventario } from '../types'

// Visual chico "disco entero" del eje: mitad izquierda/derecha coloreadas
// por el estado calculado de cada lado, con su Rd etiquetado — mismos tokens
// de color que ya usa Flota (estadoVisual.ts), no se reinventa la paleta.
export function MedidasEjeSplit({
  izquierdo,
  derecho,
}: {
  izquierdo: LadoInventario | null
  derecho: LadoInventario | null
}) {
  return (
    <div className="flex h-8 w-20 overflow-hidden rounded-full border border-concreto/20">
      <div
        className="flex flex-1 items-center justify-center text-[0.65rem] font-semibold text-white"
        style={{ background: colorEstado(izquierdo?.estadoCalculado ?? null) }}
        title={`Izquierdo — ${izquierdo?.estadoCalculado ?? 'sin medición'}`}
      >
        {izquierdo?.rdValue !== null && izquierdo?.rdValue !== undefined ? izquierdo.rdValue.toFixed(2) : '—'}
      </div>
      <div
        className="flex flex-1 items-center justify-center border-l border-white/40 text-[0.65rem] font-semibold text-white"
        style={{ background: colorEstado(derecho?.estadoCalculado ?? null) }}
        title={`Derecho — ${derecho?.estadoCalculado ?? 'sin medición'}`}
      >
        {derecho?.rdValue !== null && derecho?.rdValue !== undefined ? derecho.rdValue.toFixed(2) : '—'}
      </div>
    </div>
  )
}
