import { X } from 'lucide-react'
import { FondoEngranajes } from './FondoEngranajes'
import { GlassModal } from './GlassModal'

export type TipoFondo = 'cuadricula' | 'textura-concreto' | 'degradado' | 'aura' | 'engranajes'

const FONDOS: Record<TipoFondo, { titulo: string; clase: string }> = {
  cuadricula: { titulo: '.bg-cuadricula', clase: 'bg-cuadricula bg-arena-suave' },
  'textura-concreto': { titulo: '.bg-textura-concreto', clase: 'bg-textura-concreto bg-arena-suave' },
  degradado: { titulo: '.bg-degradado-transformacion', clase: 'bg-degradado-transformacion' },
  aura: { titulo: '.bg-aura', clase: 'bg-aura bg-cuadricula' },
  engranajes: { titulo: '.bg-engranajes-cayendo', clase: '' },
}

type ModalVistaFondoProps = {
  tipo: TipoFondo | null
  onCerrar: () => void
}

// Vista ampliada de un fondo/textura de §7 — GlassModal hace portal a
// document.body, fuera del contenedor con data-densidad="compacta" del §0,
// así esta vista SIEMPRE se ve a tamaño real (100%), nunca con la escala
// reducida exclusiva de esta demo.
export function ModalVistaFondo({ tipo, onCerrar }: ModalVistaFondoProps) {
  if (!tipo) return null
  const fondo = FONDOS[tipo]

  return (
    <GlassModal titulo={fondo.titulo} onCerrar={onCerrar} ancho={560}>
      {/* position via style inline (no la clase .absolute de Tailwind): el
          propio botón lleva la clase .glass-surface, cuya regla base ya fija
          position:relative (tokens.css, sin @layer) — al no estar en una capa
          le gana a CUALQUIER utilidad de Tailwind (sí están en @layer
          utilities) sin importar el orden o la especificidad. Solo un estilo
          inline le gana de forma confiable a esa regla. */}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        style={{ position: 'absolute' }}
        className="glass-surface glass-button-secondary right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-concreto-oscuro"
      >
        <X size={16} strokeWidth={2.25} />
      </button>
      <p className="mb-4 font-body text-xs text-concreto">Tamaño real (100%) — sin la escala reducida de esta demo.</p>
      {/* width fijado vía min() (no solo w-full) para que aspect-square dé un
          cuadrado real incluso en viewports bajos: si solo hubiera max-height,
          el alto se recortaría sin achicar el ancho y dejaría de ser 1:1. */}
      <div className="mx-auto aspect-square overflow-hidden rounded-glass" style={{ width: 'min(100%, 70vh)' }}>
        {tipo === 'engranajes' ? (
          <FondoEngranajes cantidad={30} className="h-full">
            <div className="glass-surface glass-surface--strong glass-surface--vivo absolute inset-0 m-auto flex h-fit w-40 flex-col items-center gap-1 rounded-glass-lg p-4 text-center">
              <p className="font-display text-xs font-semibold text-concreto-oscuro">Sin novedades</p>
            </div>
          </FondoEngranajes>
        ) : (
          <div className={`h-full w-full ${fondo.clase}`} />
        )}
      </div>
    </GlassModal>
  )
}
