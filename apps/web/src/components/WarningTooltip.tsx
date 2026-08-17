import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  const [coords, setCoords] = useState({ left: 0, top: 0, transform: 'translateX(-50%) translateY(4px)' })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!visible) return

    function posicionar() {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return

      const margen = 12
      const separacion = 8
      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const ancho = tooltipRect.width || 256
      const alto = tooltipRect.height || 40
      const centro = triggerRect.left + triggerRect.width / 2
      const left = Math.min(Math.max(centro, margen + ancho / 2), window.innerWidth - margen - ancho / 2)
      const cabeArriba = triggerRect.top >= alto + separacion + margen
      const cabeAbajo = triggerRect.bottom + alto + separacion + margen <= window.innerHeight
      const usarArriba = posicion === 'arriba' ? cabeArriba || !cabeAbajo : !cabeAbajo && cabeArriba
      const top = usarArriba
        ? Math.max(triggerRect.top - separacion, margen + alto)
        : Math.max(margen, Math.min(triggerRect.bottom + separacion, window.innerHeight - margen - alto))

      setCoords({
        left,
        top,
        transform: `translateX(-50%) translateY(${usarArriba ? '-100%' : '0'})`,
      })
    }

    posicionar()
    window.addEventListener('scroll', posicionar, true)
    window.addEventListener('resize', posicionar)
    return () => {
      window.removeEventListener('scroll', posicionar, true)
      window.removeEventListener('resize', posicionar)
    }
  }, [posicion, visible])

  return (
    <span
      className={`inline-flex ${className}`.trim()}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span ref={triggerRef} tabIndex={0} aria-describedby={id} className="cursor-help outline-none">
        {children}
      </span>
      {createPortal(
        <GlassSurface
          ref={tooltipRef}
          fuerte
          role="tooltip"
          id={id}
          className="pointer-events-none z-[60] w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-glass-sm px-3 py-2 font-body text-xs leading-snug text-concreto-oscuro"
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            opacity: visible ? 1 : 0,
            transform: coords.transform,
            overflowWrap: 'anywhere',
            transition:
              'opacity var(--duracion-rapida) var(--ease-apple), transform var(--duracion-rapida) var(--ease-apple)',
          }}
        >
          {texto}
        </GlassSurface>,
        document.body,
      )}
    </span>
  )
}
