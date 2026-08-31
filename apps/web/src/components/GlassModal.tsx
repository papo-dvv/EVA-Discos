import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { GlassSurface } from './GlassSurface'

const SELECTOR_ENFOCABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modal con backdrop desenfocado + card glass fuerte (styles.md §9). Cierra al
// hacer clic fuera o con Escape, atrapa el foco dentro mientras está abierto
// (accesibilidad básica) y entra con un fade + scale suave (--ease-apple).
type GlassModalProps = {
  titulo?: ReactNode
  onCerrar: () => void
  ancho?: number
  // Si se define (ej. '80vh'), la superficie queda con esta altura máxima; la
  // zona de `children` pasa a ser un contenedor flex-column con
  // overflow:hidden — cualquier hijo directo de `children` que NO deba
  // scrollear (ej. un párrafo de descripción) simplemente ocupa su alto
  // natural, mientras que el que SÍ deba hacerlo debe ser un
  // <ScrollArea className="min-h-0 flex-1 flex flex-col" viewportClassName="min-h-0 flex-1">
  // para quedarse con el espacio restante y scrollear con el mismo scrollbar
  // delgado del resto de la app (ver ModalFilasConProblemas). NO usar
  // viewportClassName="h-full" (height:100%): no resuelve de forma confiable
  // contra el alto que flexbox le da a .eva-scroll-area acá — sin clip ni
  // scrollbar, la lista se corta en silencio por fuera del área visible del
  // modal (confirmado en vivo). `footer` (si se pasa) queda SIEMPRE visible,
  // fuera de esa zona. Sin definir `altoMaximo` (default), el modal sigue
  // creciendo libremente con su contenido — el comportamiento de siempre,
  // pensado para diálogos cortos (ConfirmDialog y la mayoría de los modales).
  altoMaximo?: string
  footer?: ReactNode
  children?: ReactNode
}

export function GlassModal({
  titulo,
  onCerrar,
  ancho = 420,
  altoMaximo,
  footer,
  children,
}: GlassModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  // Si el usuario prefiere menos movimiento, arranca ya visible (sin fade):
  // así el efecto de abajo nunca necesita decidir un setState síncrono según
  // la preferencia, solo dispara el frame de la animación cuando corresponde.
  const [visible, setVisible] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCerrar])

  // Entrada suave: arranca en opacity/scale reducidos y anima al frame
  // siguiente al montaje (no-op si ya arrancó visible por prefers-reduced-motion).
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Foco atrapado: al abrir, enfoca el primer elemento enfocable del modal;
  // Tab/Shift+Tab ciclan dentro del modal en vez de escapar a la página de
  // atrás; al cerrar, devuelve el foco a lo que estaba enfocado antes.
  useEffect(() => {
    const contenedor = overlayRef.current
    if (!contenedor) return
    const previo = document.activeElement as HTMLElement | null

    const enfocables = () =>
      Array.from(contenedor.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE))

    const primero = enfocables()[0]
    ;(primero ?? contenedor).focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = enfocables()
      if (items.length === 0) return
      const primero = items[0]
      const ultimo = items[items.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    contenedor.addEventListener('keydown', onKeyDown)
    return () => {
      contenedor.removeEventListener('keydown', onKeyDown)
      previo?.focus()
    }
  }, [])

  // Portal a <body>: así el overlay fijo escapa cualquier ancestro con
  // backdrop-filter/transform (que crearía un bloque contenedor y descentraría
  // el modal), p.ej. cuando se abre desde dentro de un panel glass.
  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        // stopPropagation: sin esto, un modal anidado dentro de otro (ej.
        // FirmaDigital abierto sobre Cambio de Disco) hace que el clic en SU
        // PROPIO backdrop también cierre el modal de afuera — React reenvía
        // los eventos sintéticos por el árbol de React, no por el DOM real,
        // así que un clic en un overlay portado igual burbujea hasta el
        // overlay del modal ancestro que lo contiene lógicamente (confirmado
        // en vivo: "la ventana modal se destruye" al usar Firma digital).
        e.stopPropagation()
        onCerrar()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{
        background: 'rgba(35, 40, 33, 0.28)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <GlassSurface
        fuerte
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-glass-lg p-5 sm:p-6"
        style={{
          width: ancho,
          maxWidth: 'calc(100vw - 1.5rem)',
          maxHeight: altoMaximo ?? 'calc(100dvh - 1.5rem)',
          overflow: 'hidden',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          transition: 'opacity var(--duracion-base) var(--ease-apple), transform var(--duracion-base) var(--ease-apple)',
          // Ver comentario homólogo en WarningTooltip.tsx: .glass-surface--strong
          // trae su propia animación de entrada (eva-superficie-entrada,
          // tokens.css) que anima opacity/transform con fill-mode:both — sin
          // este override gana sobre los inline de arriba, que son los que
          // controlan la apertura/cierre real del modal.
          animation: 'none',
        }}
      >
        {titulo && (
          <h2 className="mb-1 shrink-0 break-words font-display text-lg font-semibold text-concreto-oscuro">
            {titulo}
          </h2>
        )}
        {altoMaximo ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="min-h-0 overflow-y-auto break-words pr-1">{children}</div>
        )}
        {footer && <div className="shrink-0">{footer}</div>}
      </GlassSurface>
    </div>,
    document.body,
  )
}
