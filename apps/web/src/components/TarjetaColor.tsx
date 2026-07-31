import type { Swatch } from '../data/showcase'

// Sin .glass-surface a propósito: el brillo especular del glass distorsionaría
// la lectura del color plano que esta tarjeta existe para mostrar.
export function TarjetaColor({ s }: { s: Swatch }) {
  return (
    <div className="eva-elevar overflow-hidden rounded-glass border border-white/70 bg-white/60 shadow-glass">
      <div className="h-16 border-b border-white/60" style={{ background: s.hex }} />
      <div className="p-3">
        <p className="font-body text-sm font-medium text-concreto-oscuro">{s.nombre}</p>
        <p className="font-data text-xs text-concreto">{s.variable}</p>
        <p className="font-data text-xs text-concreto">{s.hex}</p>
      </div>
    </div>
  )
}
