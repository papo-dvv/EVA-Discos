import type { ReactNode } from 'react'
import { GlassSurface } from './GlassSurface'

// Alerta de flota/sistema con color FUERTE y saturado — a propósito distinta
// del borde-glow sutil de las tarjetas de estado (styles.md §1: "las tarjetas
// de estado usan siempre un borde-glow... así el verde/blanco del tren queda
// reservado para lo positivo"). Estas alertas (datos faltantes, brecha de
// fechas severa) son avisos de sistema, no el estado de un disco puntual — el
// fondo sólido saturado las separa visualmente de los chips §6.1 para que
// nunca se confundan una con otra. Reutilizada por fleet-completeness y
// measurement-gap: un solo lugar para este tratamiento, no una variante por
// feature.
type Tono = 'critico' | 'cambio'

const FONDO: Record<Tono, string> = {
  critico:
    'linear-gradient(135deg, color-mix(in srgb, var(--color-estado-critico) 92%, black 8%) 0%, var(--color-estado-critico) 100%)',
  cambio:
    'linear-gradient(135deg, color-mix(in srgb, var(--color-estado-cambio) 92%, black 8%) 0%, var(--color-estado-cambio) 100%)',
}

type Props = {
  tono: Tono
  glifo?: ReactNode
  titulo: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  className?: string
  children?: ReactNode
}

export function TarjetaAlertaFuerte({
  tono,
  glifo,
  titulo,
  descripcion,
  acciones,
  className = '',
  children,
}: Props) {
  return (
    <GlassSurface
      elevar
      className={`rounded-glass p-4 text-white ${className}`.trim()}
      style={{ background: FONDO[tono], borderColor: 'rgba(255,255,255,0.4)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {glifo && <span className="mt-0.5 flex-shrink-0 text-lg leading-none">{glifo}</span>}
          <div>
            <h3 className="font-display text-base font-semibold">{titulo}</h3>
            {descripcion && <p className="mt-0.5 font-body text-xs text-white/90">{descripcion}</p>}
          </div>
        </div>
        {acciones && <div className="flex-shrink-0">{acciones}</div>}
      </div>
      {children}
    </GlassSurface>
  )
}
