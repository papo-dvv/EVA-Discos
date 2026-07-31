import { useCallback } from 'react'

// Tilt 3D reactivo estilo Apple (styles.md §4.1). Devuelve un callback ref: al
// montarse el nodo, engancha los listeners de puntero y los limpia al desmontar
// (cleanup de ref, React 19). Es motion REACTIVO (no corre solo), por eso no
// cuenta contra el presupuesto de motion continuo (§5). Respeta
// prefers-reduced-motion: si está activo, no engancha nada.
export function usePunteroTilt(maxGrados = 9) {
  return useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      const reducido =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reducido) return

      let frame: number | null = null

      const onMove = (e: PointerEvent) => {
        const rect = node.getBoundingClientRect()
        // Posición del puntero relativa al centro, en el rango [-0.5, 0.5]
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        if (frame !== null) cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          // rotateY sigue el eje X del puntero; rotateX se invierte para que la
          // esquina más cercana al cursor "baje" (sensación de press físico).
          node.style.setProperty('--tilt-y', `${(px * maxGrados).toFixed(2)}deg`)
          node.style.setProperty('--tilt-x', `${(-py * maxGrados).toFixed(2)}deg`)
          node.dataset.activo = 'true'
        })
      }

      const onLeave = () => {
        if (frame !== null) cancelAnimationFrame(frame)
        node.style.setProperty('--tilt-x', '0deg')
        node.style.setProperty('--tilt-y', '0deg')
        node.dataset.activo = 'false'
      }

      node.addEventListener('pointermove', onMove)
      node.addEventListener('pointerleave', onLeave)

      return () => {
        node.removeEventListener('pointermove', onMove)
        node.removeEventListener('pointerleave', onLeave)
        if (frame !== null) cancelAnimationFrame(frame)
      }
    },
    [maxGrados],
  )
}
