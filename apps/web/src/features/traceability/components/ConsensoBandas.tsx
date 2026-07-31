import type { ConsensoLimites } from '../types'
import { COLOR_EXTREMO_CONSENSO, COLOR_LIMITE_CONSENSO } from './chart-shared'

type Props = {
  consenso: ConsensoLimites
  escalaY: (v: number) => number
  x: number
  ancho: number
}

// Las 2 "franjas"/"rieles" de consenso — únicas piezas que se repiten
// IDÉNTICAS en ambos gráficos (Diagnóstico completo y Trazabilidad limpia).
// Extremo va primero (más ancho, contiene siempre al de límite por
// construcción — ver TraceabilityStatsService.calcularConsenso en el
// backend) para que el límite quede visualmente "encima".
export function ConsensoBandas({ consenso, escalaY, x, ancho }: Props) {
  return (
    <>
      <rect
        x={x}
        y={escalaY(consenso.extremoConsenso.superior)}
        width={ancho}
        height={Math.max(
          0,
          escalaY(consenso.extremoConsenso.inferior) - escalaY(consenso.extremoConsenso.superior),
        )}
        fill={COLOR_EXTREMO_CONSENSO}
        fillOpacity={0.08}
        stroke={COLOR_EXTREMO_CONSENSO}
        strokeOpacity={0.55}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <rect
        x={x}
        y={escalaY(consenso.limiteConsenso.superior)}
        width={ancho}
        height={Math.max(
          0,
          escalaY(consenso.limiteConsenso.inferior) - escalaY(consenso.limiteConsenso.superior),
        )}
        fill={COLOR_LIMITE_CONSENSO}
        fillOpacity={0.1}
        stroke={COLOR_LIMITE_CONSENSO}
        strokeWidth={2}
      />
    </>
  )
}
