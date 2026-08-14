import { useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { SegmentedControl } from '../../../components/SegmentedControl'
import type {
  AsimetriaResumen,
  ClasificacionAsimetria,
  ConsensoLimites,
  EstadisticasGenerales,
  MetodoDescrito,
} from '../types'
import { PanelEstadisticasTrazabilidad } from './PanelEstadisticasTrazabilidad'
import { PanelMetodosTrazabilidad } from './PanelMetodosTrazabilidad'
import { PanelPromedioPorTren } from './PanelPromedioPorTren'

type Vista = 'metodos' | 'estadisticas' | 'tren'

const OPCIONES_VISTA: { valor: Vista; etiqueta: string }[] = [
  { valor: 'metodos', etiqueta: 'Métodos' },
  { valor: 'estadisticas', etiqueta: 'Estadísticas' },
  { valor: 'tren', etiqueta: 'Tren' },
]

type Props = {
  conteo: number
  gauss: MetodoDescrito
  percentiles: MetodoDescrito
  tukey: MetodoDescrito
  consenso: ConsensoLimites
  clasificacionAsimetria: ClasificacionAsimetria | null
  estadisticas: EstadisticasGenerales
  asimetria: AsimetriaResumen
  paresTrasRecorte: number
  conteoTotalHistorico: number
  conteoMostradoEnPeriodo: number
  etiquetaPeriodo: string
  // Promedio por tren SÍ respeta este switch (a diferencia de Promedio por
  // tipo de coche, que ya no vive en esta pantalla — ver PanelPromedioPorTren
  // y PanelPromedioPorVagon en Proyección).
  filtrarPorRangoKm: boolean
}

// Antes eran 4 cards apiladas en 2 filas de grid (Métodos y límites /
// Estadísticas generales / Promedio por tren / Promedio por tipo de coche) —
// demasiado para el ojo de un vistazo. Ahora es UN solo bloque glass con un
// ToggleSegment de 3 opciones arriba del título de cada card: Métodos |
// Estadísticas | Tren. Solo se muestra la card seleccionada; las otras 2
// quedan montadas pero `hidden` (no desmontadas) para no perder su estado ni
// disparar un refetch de más cada vez que se alterna. "Promedio por tipo de
// coche" queda fuera de este bloque — "Tren" ocupa la posición donde vivía
// antes; ese promedio sigue disponible tal cual en Proyección (ver
// PanelPromedioPorVagon), sin cambios.
export function PanelLateralTrazabilidad({
  conteo,
  gauss,
  percentiles,
  tukey,
  consenso,
  clasificacionAsimetria,
  estadisticas,
  asimetria,
  paresTrasRecorte,
  conteoTotalHistorico,
  conteoMostradoEnPeriodo,
  etiquetaPeriodo,
  filtrarPorRangoKm,
}: Props) {
  const [vista, setVista] = useState<Vista>('metodos')

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <SegmentedControl
        ariaLabel="Vista: métodos y límites, estadísticas generales o promedio por tren"
        opciones={OPCIONES_VISTA}
        valor={vista}
        onCambiar={setVista}
        className="mb-4"
      />

      <div hidden={vista !== 'metodos'}>
        <PanelMetodosTrazabilidad
          conteo={conteo}
          gauss={gauss}
          percentiles={percentiles}
          tukey={tukey}
          consenso={consenso}
          clasificacionAsimetria={clasificacionAsimetria}
        />
      </div>

      <div hidden={vista !== 'estadisticas'}>
        <PanelEstadisticasTrazabilidad
          estadisticas={estadisticas}
          asimetria={asimetria}
          paresTrasRecorte={paresTrasRecorte}
          conteoTotalHistorico={conteoTotalHistorico}
          conteoMostradoEnPeriodo={conteoMostradoEnPeriodo}
          etiquetaPeriodo={etiquetaPeriodo}
        />
      </div>

      <div hidden={vista !== 'tren'}>
        <PanelPromedioPorTren filtrarPorRangoKm={filtrarPorRangoKm} />
      </div>
    </GlassSurface>
  )
}
