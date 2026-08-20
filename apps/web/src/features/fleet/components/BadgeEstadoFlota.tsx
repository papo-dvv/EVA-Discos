import { WarningTooltip } from '../../../components/WarningTooltip'
import type { EstadoDisco } from '../../scan-records/types'
import { ESTADO_META } from './estadoVisual'

type Props = {
  estado: Extract<EstadoDisco, 'CAMBIO' | 'CRITICO' | 'REPERFILADO'>
  conteo: number
}

export function BadgeEstadoFlota({ estado, conteo }: Props) {
  const meta = ESTADO_META[estado]
  return (
    <WarningTooltip texto={`${conteo} disco(s) en estado ${meta.etiqueta}`} posicion="abajo">
      <span className={`tabla-chip ${meta.chipClass}`}>
        {meta.etiqueta} · {conteo}
      </span>
    </WarningTooltip>
  )
}
