import { CalendarClock } from 'lucide-react'
import { GlassButton } from '../../../components/GlassButton'

// Botón compartido para completar un campo de fecha con la fecha actual sin
// tipear. Se mantiene compacto para encajar junto a inputs de fecha.
export function BotonFechaHoy({ onClick }: { onClick: () => void }) {
  return (
    <GlassButton
      type="button"
      variante="secundario"
      onClick={onClick}
      aria-label="Usar fecha de hoy"
      title="Usar fecha de hoy"
      className="px-2 py-1.5"
    >
      <CalendarClock size={14} aria-hidden />
    </GlassButton>
  )
}
