import { useAnimatedNumber } from '../hooks/useAnimatedNumber'

type Props = {
  valor: number | null | undefined
  decimales?: number
  prefijo?: string
  sufijo?: string
  className?: string
}

export function AnimatedNumber({ valor, decimales = 0, prefijo = '', sufijo = '', className }: Props) {
  const mostrado = useAnimatedNumber(valor)
  if (mostrado == null) return <span className={className}>—</span>
  const formateado = new Intl.NumberFormat('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(mostrado)
  return <span className={className}>{prefijo}{formateado}{sufijo}</span>
}
