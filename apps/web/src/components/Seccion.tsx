import type { CSSProperties, ReactNode } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

// Cada sección de la galería es en sí misma la demo en vivo de .eva-revelar
// (styles.md §5): título y contenido entran con delay escalonado al hacer scroll.
type SeccionProps = {
  id: string
  numero: string
  titulo: string
  nota?: string
  children: ReactNode
}

export function Seccion({ id, numero, titulo, nota, children }: SeccionProps) {
  const { ref, visible } = useScrollReveal<HTMLElement>()
  return (
    <section id={id} ref={ref} className="mb-[6.4rem] scroll-mt-28">
      <div
        className={`eva-revelar mb-4 flex items-baseline gap-2 ${visible ? 'is-visible' : ''}`}
        style={{ '--reveal-delay': '0ms' } as CSSProperties}
      >
        <span className="font-data text-xs text-concreto">{numero}</span>
        <h2 className="font-display text-xl font-semibold tracking-tight text-concreto-oscuro">{titulo}</h2>
      </div>
      {nota && (
        <p
          className={`eva-revelar mb-5 max-w-2xl text-xs text-concreto ${visible ? 'is-visible' : ''}`}
          style={{ '--reveal-delay': '120ms' } as CSSProperties}
        >
          {nota}
        </p>
      )}
      <div className={`eva-revelar ${visible ? 'is-visible' : ''}`} style={{ '--reveal-delay': '220ms' } as CSSProperties}>
        {children}
      </div>
    </section>
  )
}
