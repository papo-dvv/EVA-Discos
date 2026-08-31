type Props = {
  porcentaje: number | null
  // 'subirEsMalo': más es peor (ej. tasa de desgaste) -> sube = rojo, baja = verde.
  // 'subirEsBueno': más es mejor (ej. % de cambios cumplidos) -> sube = verde, baja = rojo.
  sentido: 'subirEsMalo' | 'subirEsBueno'
}

// Flecha + % de variación vs. el mes anterior — sin equivalente previo en EVA
// (a diferencia de EVA-Aldy, que sí tiene un DeltaPill). Vive dentro de
// `.inicio-card__foto-valor`, como texto en línea junto al valor principal —
// nunca como elemento posicionado aparte, para no repetir el ajuste fino de
// coordenadas por imagen que ya costó varias iteraciones en las cards
// fotográficas del dashboard.
export function IndicadorVariacion({ porcentaje, sentido }: Props) {
  if (porcentaje === null || !Number.isFinite(porcentaje)) return null

  const redondeado = Math.round(porcentaje)
  const sube = redondeado > 0
  const baja = redondeado < 0
  const bueno = sentido === 'subirEsMalo' ? baja : sube
  const malo = sentido === 'subirEsMalo' ? sube : baja
  const claseColor = bueno ? 'indicador-variacion--bueno' : malo ? 'indicador-variacion--malo' : 'indicador-variacion--neutro'
  const flecha = sube ? '▲' : baja ? '▼' : '–'

  return (
    <span className={`indicador-variacion ${claseColor}`}>
      {flecha} {Math.abs(redondeado)}%
    </span>
  )
}
