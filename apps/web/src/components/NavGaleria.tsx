import { useState } from 'react'
import type { NavItem } from '../data/showcase'
import { Marca } from './Marca'

// Nav flotante persistente (styles.md §9): .glass-surface sticky, sin --vivo
// porque no es la pieza hero. En md+ se listan los enlaces inline; debajo de
// ese punto de quiebre se pliegan en un panel .glass-surface--strong propio
// — el menú móvil es, en sí mismo, otra demo de componente glass.
export function NavGaleria({ items }: { items: NavItem[] }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <nav className="sticky top-4 z-30 mx-auto w-[min(92%,72rem)]">
      <div className="flex items-center justify-between gap-4 rounded-glass glass-surface px-5 py-3">
        <Marca tamano="condensado" />
        <div className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 font-body text-xs text-concreto-oscuro transition-colors duration-200 hover:bg-white/40 hover:text-verde-oscuro"
            >
              {item.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAbierto((valor) => !valor)}
          aria-expanded={abierto}
          aria-controls="nav-galeria-movil"
          className="glass-chip font-medium text-concreto-oscuro md:hidden"
        >
          {abierto ? 'Cerrar' : 'Secciones'}
        </button>
      </div>

      {abierto && (
        <div
          id="nav-galeria-movil"
          className="glass-surface glass-surface--strong mt-2 grid grid-cols-2 gap-1 rounded-glass p-3 md:hidden"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="rounded-full px-3 py-2 font-body text-xs text-concreto-oscuro transition-colors duration-200 hover:bg-white/40 hover:text-verde-oscuro"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
