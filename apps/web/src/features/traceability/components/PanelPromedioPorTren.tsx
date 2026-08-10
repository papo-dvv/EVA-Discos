import type { PromedioPorTren } from '../types'
import { TarjetaPromedioConsenso } from './TarjetaPromedioConsenso'

type Props = {
  promedioPorTren: PromedioPorTren
}

// Promedio de TODOS los pares válidos del tren pedido (o de toda la flota si
// no hay tren seleccionado en el scope de la pantalla) — sin tipoCoche/
// bogieCodigo y sin ningún recorte de km (ver
// TraceabilityService.obtenerPromedioPorTren, backend). Por eso NUNCA se ve
// afectado por el switch "Considerar solo rango de km habitual".
export function PanelPromedioPorTren({ promedioPorTren }: Props) {
  const { tren, ...datos } = promedioPorTren
  const alcance = tren !== null ? `del tren ${tren}` : 'de toda la flota'

  return (
    <TarjetaPromedioConsenso
      titulo="Promedio por tren"
      descripcion={
        <>
          Calculado con <b>todos</b> los pares válidos {alcance}, combinando cualquier tipo de coche y bogie —
          nunca solo un subconjunto.
        </>
      }
      datos={datos}
      contexto={tren !== null ? `en el tren ${tren}` : 'en la flota'}
      mensajeVacio="No hay pares suficientes para calcular límites en este alcance."
    />
  )
}
