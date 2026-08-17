import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { usePunteroTilt } from '../hooks/usePunteroTilt'

// Superficie Liquid Glass reutilizable (styles.md §4). Compone las clases
// .glass-surface* y las primitivas de movimiento según los flags. Si `tilt`
// está activo, engancha el tilt 3D reactivo (§4.1) vía callback ref.
type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  fuerte?: boolean
  vivo?: boolean
  iris?: boolean
  elevar?: boolean
  tilt?: boolean
  className?: string
  children?: ReactNode
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
  {
    fuerte = false,
    vivo = false,
    iris = false,
    elevar = false,
    tilt = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const tiltRef = usePunteroTilt()

  const clases = [
    'glass-surface',
    fuerte && 'glass-surface--strong',
    vivo && 'glass-surface--vivo',
    iris && 'glass-surface--iris',
    elevar && 'eva-elevar',
    tilt && 'eva-tilt',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={(node) => {
        if (tilt) tiltRef(node)
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className={clases}
      {...rest}
    >
      {children}
    </div>
  )
})
