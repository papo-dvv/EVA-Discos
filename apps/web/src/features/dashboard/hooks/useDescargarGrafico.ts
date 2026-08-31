import { toPng } from 'html-to-image'
import { useCallback, useState, type RefObject } from 'react'

// Los gráficos del dashboard son SVG dibujados a mano (sin librería de
// charting en el proyecto) — html-to-image serializa el contenedor tal cual
// se ve en pantalla a un PNG, sin tener que reescribir nada como canvas.
export function useDescargarGrafico(objetivoRef: RefObject<HTMLElement | null>) {
  const [descargando, setDescargando] = useState(false)

  const descargar = useCallback(
    async (nombreArchivo: string) => {
      const nodo = objetivoRef.current
      if (!nodo || descargando) return

      setDescargando(true)
      try {
        const dataUrl = await toPng(nodo, { backgroundColor: '#ffffff', pixelRatio: 2 })
        const enlace = document.createElement('a')
        enlace.href = dataUrl
        enlace.download = nombreArchivo
        enlace.click()
      } finally {
        setDescargando(false)
      }
    },
    [objetivoRef, descargando],
  )

  return { descargar, descargando }
}
