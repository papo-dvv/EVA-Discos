import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { GlassSurface } from './GlassSurface'

type Props = {
  texto: ReactNode
  children: ReactNode
  posicion?: 'arriba' | 'abajo'
  className?: string
}

// Tooltip reutilizable con estética Liquid Glass — reemplaza el `title`
// nativo del navegador en cualquier ícono/badge de advertencia de la app
// (discrepancias de Migración, badges de outlier de Tasa de Desgaste, conteo
// de filas con advertencia del sidebar, etc.): un solo componente, nunca una
// implementación de tooltip propia por pantalla. Se activa por hover Y por
// foco de teclado — el `title` nativo del navegador no es alcanzable de
// forma confiable con teclado.
export function WarningTooltip({ texto, children, posicion = 'arriba', className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <span
      className={`relative inline-flex ${className}`.trim()}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span tabIndex={0} aria-describedby={id} className="cursor-help outline-none">
        {children}
      </span>
      <GlassSurface
        fuerte
        role="tooltip"
        id={id}
        className={`pointer-events-none z-40 w-max max-w-[16rem] rounded-glass-sm px-3 py-2 font-body text-xs leading-snug text-concreto-oscuro ${
          posicion === 'arriba' ? 'bottom-full left-1/2 mb-2' : 'top-full left-1/2 mt-2'
        }`}
        style={{
          // position:absolute por INLINE style (no la clase `absolute` de
          // Tailwind): .glass-surface fija `position: relative` en tokens.css
          // como CSS plano, fuera de cualquier @layer — por cascade layers,
          // eso le gana SIEMPRE a la utilidad `absolute` de Tailwind
          // (@layer utilities), sin importar el orden de las clases. Sin este
          // override, el tooltip queda en flujo normal (invisible pero
          // reservando su alto real), empujando el contenido de al lado — el
          // bug real detrás de "floating in empty space" reportado en P.T.
          position: 'absolute',
          opacity: visible ? 1 : 0,
          transform: `translateX(-50%) translateY(${
            visible ? '0' : posicion === 'arriba' ? '4px' : '-4px'
          })`,
          transition:
            'opacity var(--duracion-rapida) var(--ease-apple), transform var(--duracion-rapida) var(--ease-apple)',
        }}
      >
        {texto}
      </GlassSurface>
    </span>
  )
}
