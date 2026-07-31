import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Botón glass en forma píldora (styles.md §4). `primario` es el CTA verde con
// glow; `secundario` es una superficie glass neutra. Ambos con hover/press de
// --ease-apple ya definidos en tokens.css.
type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario'
  cargando?: boolean
  bloque?: boolean
  children?: ReactNode
}

export function GlassButton({
  variante = 'primario',
  cargando = false,
  bloque = false,
  className = '',
  disabled,
  children,
  ...rest
}: GlassButtonProps) {
  const base =
    variante === 'primario'
      ? 'glass-button-primary'
      : 'glass-surface glass-button-secondary text-concreto-oscuro'

  const clases = [
    base,
    'inline-flex items-center justify-center gap-2 px-6 py-3 font-body text-sm font-semibold',
    bloque && 'w-full',
    (disabled || cargando) && 'cursor-not-allowed opacity-60',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={clases} disabled={disabled || cargando} {...rest}>
      {children}
    </button>
  )
}
