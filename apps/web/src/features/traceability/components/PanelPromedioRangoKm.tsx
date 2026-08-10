import type { PromedioRangoKm } from '../types'
import { TarjetaPromedioConsenso } from './TarjetaPromedioConsenso'

type Props = {
  // Todo sale de acá: esta card NO recibe el consenso ni el conteo globales a
  // propósito. Sus límites se calculan solo con los pares del rango de km (ver
  // TraceabilityService.calcularPromedioRangoKm), y mezclarlos con los de
  // "Métodos y límites" sería justamente el error que esta card evita.
  promedioRangoKm: PromedioRangoKm
}

// Promedio calculado aparte sobre los pares con un intervalo de kilometraje ni
// muy corto (más sensible a ruido de extrapolación) ni muy largo (mezcla más
// tiempo/desgaste en un solo par). A diferencia de Estadísticas generales, este
// subconjunto genera sus propios límites de consenso. NUNCA se ve afectado por
// el switch "Considerar solo rango de km habitual" (ver Trazabilidad.tsx): ese
// switch cambia qué pares alimentan Métodos y límites/Estadísticas/gráficos,
// esta card siempre corre sobre TODOS los pares del alcance.
export function PanelPromedioRangoKm({ promedioRangoKm }: Props) {
  const { kmMinimo, kmMaximo, ...datos } = promedioRangoKm

  return (
    <TarjetaPromedioConsenso
      titulo="Promedio por rango de km"
      descripcion={
        <>
          Calculado <b>solo</b> con los pares de {kmMinimo}–{kmMaximo} km de diferencia entre mediciones: los límites
          de abajo salen de ese subconjunto, no del consenso general.
        </>
      }
      datos={datos}
      contexto="en este rango"
      mensajeVacio="No hay pares suficientes en este rango de km para calcular límites en el alcance elegido."
    />
  )
}
