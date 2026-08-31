import { useEffect, useRef, useState } from 'react'

// Conteo ascendente con easing cúbico (900ms), igual patrón que
// AnimatedMetricValue de EVA-Aldy — se reinicia desde 0 cada vez que
// `valor` cambia (ej. tras un refetch).
export function useAnimatedNumber(valor: number | null | undefined, duracionMs = 900) {
  const [valorMostrado, setValorMostrado] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (valor == null || !Number.isFinite(valor)) return

    const inicio = performance.now()
    const tick = (ahora: number) => {
      const progreso = Math.min((ahora - inicio) / duracionMs, 1)
      const suavizado = 1 - Math.pow(1 - progreso, 3)
      setValorMostrado(valor * suavizado)
      if (progreso < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameRef.current ?? 0)
  }, [valor, duracionMs])

  return valor == null || !Number.isFinite(valor) ? null : valorMostrado
}
