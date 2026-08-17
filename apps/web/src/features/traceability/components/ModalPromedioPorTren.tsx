import type { ReactNode } from 'react'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { usePromedioPorTren } from '../queries'
import { textoAdvertenciaDatosLimitados } from '../textoAdvertenciaPromedioPorTren'
import type { PromedioPorTrenItem, PromedioPorTrenTipoCocheItem } from '../types'

type Props = {
  filtrarPorRangoKm: boolean
  onCerrar: () => void
}

// Mismo orden físico que devuelve el backend (Object.values(TipoCoche) en
// TraceabilityService.obtenerPromedioPorTren) — MA1/MB1/MB3/REM/MB2/MA2,
// nunca alfabético.
const TIPOS_COCHE = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const

// Detalle completo de "Promedio por tren": los 39 (T06–T44), con
// incluirDetalle=true — a diferencia de la card principal (PanelPromedioPorTren),
// pide el desglose por tipo de coche de cada uno. Query aparte (propia clave
// con incluirDetalle:true) para no cargarlo hasta que el usuario lo abre. Una
// sola tabla de 39 filas con scroll interno, sin paginación — el desglose por
// tipo de coche va en columnas (MA1..MA2), no en un acordeón por fila.
export function ModalPromedioPorTren({ filtrarPorRangoKm, onCerrar }: Props) {
  const promedioPorTren = usePromedioPorTren({ filtrarPorRangoKm, incluirDetalle: true })

  return (
    <GlassModal titulo="Promedio por tren — flota completa" onCerrar={onCerrar} ancho={800}>
      <p className="mb-3 font-body text-xs text-concreto">
        Los 39 trenes (T06–T44), con el desglose por tipo de coche de cada uno.
      </p>

      {promedioPorTren.isLoading ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : promedioPorTren.isError || !promedioPorTren.data ? (
        <p className="font-body text-sm text-concreto">No se pudo cargar el detalle.</p>
      ) : (
        <ScrollArea ejes="both" viewportClassName="max-h-[60vh]">
          <table className="w-full font-data text-xs">
            <thead>
              <tr className="text-left">
                <Encabezado>Tren</Encabezado>
                <Encabezado>Promedio del Tren</Encabezado>
                <th className="pb-1.5 pr-2">
                  <span className="sr-only">Advertencia</span>
                </th>
                {TIPOS_COCHE.map((t) => (
                  <Encabezado key={t}>{t}</Encabezado>
                ))}
              </tr>
            </thead>
            <tbody>
              {promedioPorTren.data.map((item) => (
                <FilaTren key={item.tren} item={item} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </GlassModal>
  )
}

function Encabezado({ children }: { children: ReactNode }) {
  return (
    <th className="pb-1.5 pr-3 whitespace-nowrap font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
      {children}
    </th>
  )
}

function FilaTren({ item }: { item: PromedioPorTrenItem }) {
  const porTipoCoche = new Map((item.porTipoCoche ?? []).map((t) => [t.tipoCoche, t]))

  return (
    <tr className="border-t border-concreto/10">
      <td className="py-1.5 pr-3 whitespace-nowrap text-concreto-oscuro">T{item.tren}</td>
      <td className="py-1.5 pr-3 whitespace-nowrap text-concreto-oscuro">
        {item.promedio !== null ? item.promedio.toFixed(4) : '—'}
      </td>
      <td className="py-1.5 pr-3">
        {item.promedio !== null && item.datosLimitados && (
          <WarningTooltip texto={textoAdvertenciaDatosLimitados(item.conteoParesUsados)}>⚠️</WarningTooltip>
        )}
      </td>
      {TIPOS_COCHE.map((t) => (
        <CeldaTipoCoche key={t} item={porTipoCoche.get(t)} />
      ))}
    </tr>
  )
}

function CeldaTipoCoche({ item }: { item?: PromedioPorTrenTipoCocheItem }) {
  if (!item) {
    return <td className="py-1.5 pr-3 whitespace-nowrap text-concreto">—</td>
  }
  return (
    <td className="py-1.5 pr-3 whitespace-nowrap text-concreto-oscuro">
      <span className="inline-flex items-center gap-1.5">
        {item.promedio !== null ? item.promedio.toFixed(4) : '—'}
        {item.promedio !== null && item.datosLimitados && (
          <WarningTooltip texto={textoAdvertenciaDatosLimitados(item.conteoParesUsados)}>⚠️</WarningTooltip>
        )}
      </span>
    </td>
  )
}
