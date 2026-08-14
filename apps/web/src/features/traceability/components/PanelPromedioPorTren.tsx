import { useState } from 'react'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { usePromedioPorTren } from '../queries'
import { textoAdvertenciaDatosLimitados } from '../textoAdvertenciaPromedioPorTren'
import type { PromedioPorTrenItem } from '../types'
import { ModalPromedioPorTren } from './ModalPromedioPorTren'

const CANTIDAD_CARD_PRINCIPAL = 10

type Props = {
  filtrarPorRangoKm: boolean
}

// Promedio de valorLimpio de cada tren (T06–T44), combinando todo tipoCoche/
// bogie — mismo pipeline (Gauss∩Percentiles∩Tukey -> consenso -> recorte ->
// promedio) que Métodos y límites/Estadísticas generales, aplicado tren por
// tren (ver TraceabilityService.obtenerPromedioPorTren, backend). Ocupa la
// posición "Tren" del toggle Métodos/Estadísticas/Tren en PanelLateralTrazabilidad
// — reemplaza a la card "Promedio por tipo de coche" que vivía ahí antes. A
// diferencia de esa card, esta SÍ respeta el switch "Considerar solo rango de
// km habitual". Solo trae los primeros 10 trenes sin desglose
// (incluirDetalle=false) — "Ver más" abre el detalle completo con desglose
// por tipo de coche.
export function PanelPromedioPorTren({ filtrarPorRangoKm }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const promedioPorTren = usePromedioPorTren({ filtrarPorRangoKm })

  return (
    <>
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">Promedio por tren</h3>
      <p className="mb-3 font-body text-xs text-concreto">
        Cada tren combina todos sus tipos de coche y bogies. Respeta el switch de arriba.
      </p>

      {promedioPorTren.isLoading ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : promedioPorTren.isError || !promedioPorTren.data ? (
        <p className="font-body text-sm text-concreto">No se pudo cargar el promedio por tren.</p>
      ) : (
        <>
          <TablaPromedioPorTren filas={promedioPorTren.data.slice(0, CANTIDAD_CARD_PRINCIPAL)} />
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="mt-3 font-body text-xs text-concreto-oscuro underline underline-offset-2 transition-colors hover:text-concreto"
          >
            Ver más
          </button>
        </>
      )}

      {modalAbierto && (
        <ModalPromedioPorTren filtrarPorRangoKm={filtrarPorRangoKm} onCerrar={() => setModalAbierto(false)} />
      )}
    </>
  )
}

// Reutilizada tal cual por el modal (ver ModalPromedioPorTren) para el
// listado de los 39 — misma forma de fila, sin duplicar el layout.
export function TablaPromedioPorTren({ filas }: { filas: PromedioPorTrenItem[] }) {
  return (
    <table className="w-full font-data text-xs">
      <thead>
        <tr className="text-left">
          <th className="pb-1.5 font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
            Tren
          </th>
          <th className="pb-1.5 font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
            Promedio
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.tren} className="border-t border-concreto/10">
            <td className="py-1.5 text-concreto-oscuro">T{f.tren}</td>
            <td className="py-1.5 text-concreto-oscuro">
              <span className="inline-flex items-center gap-1.5">
                {f.promedio !== null ? f.promedio.toFixed(4) : '—'}
                {f.promedio !== null && f.datosLimitados && (
                  <WarningTooltip texto={textoAdvertenciaDatosLimitados(f.conteoParesUsados)}>⚠️</WarningTooltip>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
