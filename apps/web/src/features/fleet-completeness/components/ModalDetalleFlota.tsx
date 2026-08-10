import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { useFleetCompletenessDetalle } from '../queries'
import type { FleetCompletenessTren } from '../types'

type Props = {
  trenes: FleetCompletenessTren[]
  trenInicial: number
  onCerrar: () => void
}

// Ventana flotante de solo lectura (styles.md §4.3: GlassModal directo, no
// ConfirmDialog — acá no hay nada que confirmar/cancelar, solo una lista).
// El backend expone /fleet-completeness/detalle de a UN tren por pedido, así
// que el modal deja elegir entre los trenes con discosFaltantes > 0 (chips)
// en vez de traer todos de una — nunca más de 39 pedidos posibles, y solo el
// tren activo se pide.
export function ModalDetalleFlota({ trenes, trenInicial, onCerrar }: Props) {
  const [tren, setTren] = useState(trenInicial)
  const detalle = useFleetCompletenessDetalle(tren)

  return (
    <GlassModal titulo="Datos faltantes — detalle por tren" onCerrar={onCerrar} ancho={640}>
      <p className="font-body text-sm text-concreto-oscuro">
        Combinaciones del catálogo esperado que nunca tuvieron ninguna medición confirmada.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {trenes.map((t) => (
          <button
            key={t.tren}
            type="button"
            onClick={() => setTren(t.tren)}
            className="glass-chip"
            data-active={tren === t.tren ? 'true' : undefined}
          >
            Tren {t.tren} · {t.discosFaltantes}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {detalle.isLoading ? (
          <p className="py-6 text-center font-body text-sm text-concreto">Cargando…</p>
        ) : detalle.isError ? (
          <p role="alert" className="py-6 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el detalle del tren {tren}.
          </p>
        ) : !detalle.data || detalle.data.length === 0 ? (
          <p className="py-6 text-center font-body text-sm text-concreto">
            Sin discos faltantes en el tren {tren}.
          </p>
        ) : (
          <ScrollArea viewportClassName="max-h-[22rem]" className="-mr-1 pr-1">
            <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
              <thead>
                <tr className="border-b border-concreto/20 text-xs font-semibold uppercase tracking-wide text-concreto">
                  <th className="px-2 py-2">Coche</th>
                  <th className="px-2 py-2">N° Coche</th>
                  <th className="px-2 py-2">Bogie</th>
                  <th className="px-2 py-2 text-right">Eje</th>
                  <th className="px-2 py-2">Lado</th>
                </tr>
              </thead>
              <tbody>
                {detalle.data.map((f, i) => (
                  <tr key={i} className="border-b border-concreto/10">
                    <td className="px-2 py-1.5 text-concreto-oscuro">{f.coche}</td>
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{f.numeroCoche}</td>
                    <td className="px-2 py-1.5 text-concreto-oscuro">{f.bogie}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">{f.eje}</td>
                    <td className="px-2 py-1.5 capitalize text-concreto-oscuro">{f.lado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
          Cerrar
        </GlassButton>
      </div>
    </GlassModal>
  )
}
