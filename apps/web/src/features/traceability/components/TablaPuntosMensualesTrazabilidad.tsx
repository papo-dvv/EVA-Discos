import { ScrollArea } from '../../../components/ScrollArea'
import type { PuntoMensualTrazabilidad } from '../types'
import { formatearMesDesdeMs, msDesdeMes } from './chart-shared'

// Twin de tabla del Gráfico 2 cuando agregacionAplicada='mensual' (ver
// TablaPuntosTrazabilidad para el twin de la vista cruda/detallada — no se
// reusa porque la forma del dato es distinta: acá no hay un "estado" por
// punto sino un desglose normal/recortado del mes).
type Props = {
  puntos: PuntoMensualTrazabilidad[]
}

export function TablaPuntosMensualesTrazabilidad({ puntos }: Props) {
  return (
    <ScrollArea ejes="both" viewportClassName="max-h-[22rem]">
      <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
        <thead>
          <tr className="border-b border-concreto/20">
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-concreto">
              Mes
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
              Promedio (valor limpio)
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
              Normal
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
              Recortado
            </th>
          </tr>
        </thead>
        <tbody>
          {puntos.map((p) => (
            <tr key={p.mes} className="tabla-fila--glass border-b border-concreto/10">
              <td className="whitespace-nowrap px-3 py-2 capitalize text-concreto-oscuro">
                {formatearMesDesdeMs(msDesdeMes(p.mes))}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-data text-concreto-oscuro">
                {p.promedioValorLimpio.toFixed(6)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-data text-verde-oscuro">{p.conteoNormal}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-data text-[color:var(--color-estado-seguimiento)]">
                {p.conteoRecortado}
              </td>
            </tr>
          ))}
          {puntos.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center font-body text-sm text-concreto">
                Sin puntos en el periodo seleccionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollArea>
  )
}
