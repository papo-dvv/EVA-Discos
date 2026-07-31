import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'

// styles.md §7.1 — fondo animado exclusivo de pantallas de solo aviso.
// Genera N engranajes con variedad de posición/tamaño/velocidad, distribuidos
// en todo el ancho (proporción áurea para que no se note un patrón repetido).
function crearEngranajes(cantidad: number) {
  return Array.from({ length: cantidad }, (_, i) => {
    const fase = (i * 0.618034) % 1
    return {
      left: `${(-12 + fase * 122).toFixed(1)}%`,
      size: 16 + ((i * 7) % 13) * 3,
      opacidad: Number((0.08 + ((i * 5) % 9) * 0.01).toFixed(2)),
      duracion: 18 + ((i * 9) % 11) * 2,
      giro: 6 + (i % 5) * 2,
      retraso: -((i * 13) % 34),
    }
  })
}

type FondoEngranajesProps = {
  cantidad?: number
  className?: string
  children?: ReactNode
}

export function FondoEngranajes({ cantidad = 30, className = '', children }: FondoEngranajesProps) {
  const engranajes = useMemo(() => crearEngranajes(cantidad), [cantidad])

  return (
    <div className={`bg-engranajes-cayendo rounded-glass ${className}`}>
      {engranajes.map((g, i) => (
        <span
          key={i}
          className="engranaje"
          style={
            {
              left: g.left,
              '--size': `${g.size}px`,
              '--opacidad': g.opacidad,
              '--duracion': `${g.duracion}s`,
              '--giro': `${g.giro}s`,
              '--retraso': `${g.retraso}s`,
            } as CSSProperties
          }
        >
          <svg width="100%" height="100%" role="presentation" aria-hidden="true">
            <use href="/icons.svg#gear-icon" />
          </svg>
        </span>
      ))}
      {children}
    </div>
  )
}
