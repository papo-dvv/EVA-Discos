import type { PromedioPorVagon } from '../../projection/types'
import { PanelPromedioPorVagon } from '../../projection/components/PanelPromedioPorVagon'
import type {
  AsimetriaResumen,
  ClasificacionAsimetria,
  ConsensoLimites,
  EstadisticasGenerales,
  MetodoDescrito,
  PromedioPorTren,
  PromedioRangoKm,
} from '../types'
import { PanelEstadisticasTrazabilidad } from './PanelEstadisticasTrazabilidad'
import { PanelMetodosTrazabilidad } from './PanelMetodosTrazabilidad'
import { PanelPromedioPorTren } from './PanelPromedioPorTren'
import { PanelPromedioRangoKm } from './PanelPromedioRangoKm'

type Props = {
  conteo: number
  gauss: MetodoDescrito
  percentiles: MetodoDescrito
  tukey: MetodoDescrito
  consenso: ConsensoLimites
  clasificacionAsimetria: ClasificacionAsimetria | null
  estadisticas: EstadisticasGenerales
  asimetria: AsimetriaResumen
  conteoTotalHistorico: number
  conteoMostradoEnPeriodo: number
  etiquetaPeriodo: string
  promedioRangoKm: PromedioRangoKm
  promedioPorTren?: PromedioPorTren
  promedioPorTrenCargando: boolean
  promedioPorVagon?: PromedioPorVagon[]
  promedioPorVagonCargando: boolean
}

// Compuesto único, reutilizado tanto en el bloque apilado (xl:hidden) como en
// la columna lateral (xl:block) de Trazabilidad.tsx — evita duplicar este
// layout cada vez más largo dos veces en la página. Dos zonas bien separadas:
// arriba, todo lo que SÍ reacciona al switch "Considerar solo rango de km
// habitual" (Métodos y límites al lado de Estadísticas generales, que ya
// incluye Asimetría); abajo, los 3 promedios que SIEMPRE corren sobre el
// conjunto completo, con una nota explícita para que no se lean como
// contradictorios cuando el switch está desactivado y estas cards no cambian.
export function PanelLateralTrazabilidad({
  conteo,
  gauss,
  percentiles,
  tukey,
  consenso,
  clasificacionAsimetria,
  estadisticas,
  asimetria,
  conteoTotalHistorico,
  conteoMostradoEnPeriodo,
  etiquetaPeriodo,
  promedioRangoKm,
  promedioPorTren,
  promedioPorTrenCargando,
  promedioPorVagon,
  promedioPorVagonCargando,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <PanelMetodosTrazabilidad
          conteo={conteo}
          gauss={gauss}
          percentiles={percentiles}
          tukey={tukey}
          consenso={consenso}
          clasificacionAsimetria={clasificacionAsimetria}
        />
        <PanelEstadisticasTrazabilidad
          estadisticas={estadisticas}
          asimetria={asimetria}
          conteoTotalHistorico={conteoTotalHistorico}
          conteoMostradoEnPeriodo={conteoMostradoEnPeriodo}
          etiquetaPeriodo={etiquetaPeriodo}
        />
      </div>

      <div>
        <p className="mb-3 border-t border-concreto/15 pt-3 font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">
          No afectado por el filtro de rango de km
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PanelPromedioRangoKm promedioRangoKm={promedioRangoKm} />
          {promedioPorTrenCargando || !promedioPorTren ? (
            <p className="font-body text-sm text-concreto">Cargando…</p>
          ) : (
            <PanelPromedioPorTren promedioPorTren={promedioPorTren} />
          )}
          <div className="sm:col-span-2">
            <PanelPromedioPorVagon datos={promedioPorVagon} cargando={promedioPorVagonCargando} />
          </div>
        </div>
      </div>
    </div>
  )
}
