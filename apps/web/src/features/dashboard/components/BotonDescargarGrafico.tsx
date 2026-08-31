import { Download } from 'lucide-react'
import type { RefObject } from 'react'
import { useDescargarGrafico } from '../hooks/useDescargarGrafico'

type Props = {
  objetivoRef: RefObject<HTMLElement | null>
  nombreArchivo: string
}

export function BotonDescargarGrafico({ objetivoRef, nombreArchivo }: Props) {
  const { descargar, descargando } = useDescargarGrafico(objetivoRef)

  return (
    <button
      type="button"
      onClick={() => descargar(nombreArchivo)}
      disabled={descargando}
      className="flex items-center gap-1.5 rounded-full border border-black/[0.08] px-2.5 py-1 font-body text-xs text-concreto-oscuro transition-colors hover:bg-black/[0.03] disabled:opacity-50"
    >
      <Download size={13} aria-hidden />
      {descargando ? 'Generando…' : 'Descargar'}
    </button>
  )
}
