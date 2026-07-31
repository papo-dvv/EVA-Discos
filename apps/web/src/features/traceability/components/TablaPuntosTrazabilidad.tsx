import { ScrollArea } from '../../../components/ScrollArea'
import type { EstadoPuntoTrazabilidad, PuntoSerieTrazabilidad } from '../types'

// Twin de tabla del gráfico (GraficoTrazabilidad): mismos datos, codificados
// en texto — para que el estado de cada punto (normal/recortado/excluido) no
// dependa solo del color en el SVG. Mismas clases .tabla-chip que ya usa
// TablaWearRate para su chip de validez.
type Props = {
  puntos: PuntoSerieTrazabilidad[]
}

const CLASE_CHIP: Record<EstadoPuntoTrazabilidad, string> = {
  normal: 'tabla-chip--ok',
  recortado: 'tabla-chip--seguimiento',
  excluido: 'tabla-chip--critico',
}

const ETIQUETA_ESTADO: Record<EstadoPuntoTrazabilidad, string> = {
  normal: 'Normal',
  recortado: 'Recortado',
  excluido: 'Excluido',
}

export function TablaPuntosTrazabilidad({ puntos }: Props) {
  return (
    <ScrollArea ejes="both" viewportClassName="max-h-[22rem]">
      <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
        <thead>
          <tr className="border-b border-concreto/20">
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-concreto">
              Fecha
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
              Tasa mensual cruda
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
              Valor limpio
            </th>
            <th className="sticky top-0 z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-concreto">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {puntos.map((p, i) => (
            <tr key={`${p.fecha}-${i}`} className="tabla-fila--glass border-b border-concreto/10">
              <td className="whitespace-nowrap px-3 py-2 text-concreto-oscuro">{p.fecha}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-data text-concreto-oscuro">
                {p.tasaMensualCruda.toFixed(6)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-data text-concreto-oscuro">
                {p.valorLimpio !== null ? p.valorLimpio.toFixed(6) : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={`tabla-chip ${CLASE_CHIP[p.estado]}`}>{ETIQUETA_ESTADO[p.estado]}</span>
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
