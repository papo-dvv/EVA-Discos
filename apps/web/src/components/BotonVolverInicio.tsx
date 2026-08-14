import { Home, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WarningTooltip } from './WarningTooltip'

type Props = {
  className?: string
}

export function BotonVolverInicio({ className = '' }: Props) {
  return (
    <WarningTooltip texto="Volver al inicio" posicion="abajo">
      <Link
        to="/"
        aria-label="Volver al inicio"
        className={`glass-surface glass-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-concreto-oscuro transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-verde-institucional/40 ${className}`.trim()}
      >
        <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
          <Home size={18} strokeWidth={1.9} />
          <Undo2
            size={12}
            strokeWidth={2.2}
            className="absolute -left-1 -top-1 text-[color:var(--color-verde-institucional)]"
          />
        </span>
      </Link>
    </WarningTooltip>
  )
}
