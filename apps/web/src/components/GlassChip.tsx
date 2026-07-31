import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Chip glass (styles.md §4). Si recibe onClick se renderiza como <button>
// (filtro clickeable); si no, como <span> decorativo. `activo` marca el estado
// seleccionado (verde-claro).
type GlassChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  activo?: boolean
  children?: ReactNode
}

export function GlassChip({
  activo = false,
  onClick,
  className = '',
  children,
  ...rest
}: GlassChipProps) {
  const clases = `glass-chip ${className}`.trim()

  if (onClick) {
    return (
      <button
        type="button"
        className={clases}
        data-active={activo ? 'true' : undefined}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    )
  }

  return (
    <span className={clases} data-active={activo ? 'true' : undefined}>
      {children}
    </span>
  )
}
