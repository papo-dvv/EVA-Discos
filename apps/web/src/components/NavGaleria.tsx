import { useEffect, useState } from 'react'
import type { NavItem } from '../data/showcase'
import { Marca } from './Marca'

// Oculta el nav al bajar y lo muestra de inmediato ante cualquier movimiento
// hacia arriba (no hace falta llegar al tope). Un solo listener de scroll
// pasivo, throttleado a un cálculo por frame vía requestAnimationFrame.
//
// Sin umbral de magnitud: con scroll suave/inercia (trackpad, `scrollIntoView`)
// el desplazamiento entre dos frames consecutivos puede ser de solo 1-2px: un
// umbral de "ignorar movimientos chicos" terminaría, en la práctica, ignorando
// CUALQUIER scroll hacia arriba gradual — justo lo opuesto de "reaparece ante
// cualquier movimiento pequeño". requestAnimationFrame ya evita recalcular más
// de una vez por frame, que es el único throttle que pide la especificación.
function useOcultarAlBajar() {
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    let ultimoY = window.scrollY
    let ticking = false

    function evaluar() {
      const actualY = window.scrollY
      const delta = actualY - ultimoY
      if (delta > 0) setOculto(true)
      else if (delta < 0) setOculto(false)
      ultimoY = actualY
      ticking = false
    }

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(evaluar)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return oculto
}

// Nav flotante persistente (styles.md §9): .glass-surface sticky, sin --vivo
// porque no es la pieza hero. En md+ se listan los enlaces inline; debajo de
// ese punto de quiebre se pliegan en un panel .glass-surface--strong propio
// — el menú móvil es, en sí mismo, otra demo de componente glass.
//
// Auto-hide (exclusivo /design-system): se oculta con transform (nunca
// height/display) para que el contenido de abajo no salte, y mantiene
// siempre el mismo alto entre secciones — sticky no se ve afectado.
export function NavGaleria({ items }: { items: NavItem[] }) {
  const [abierto, setAbierto] = useState(false)
  const oculto = useOcultarAlBajar()
  // Lectura directa (no ref/estado): matchMedia es barata y este valor no
  // necesita disparar un re-render si cambia mientras el nav ya está montado.
  const prefiereMenosMovimiento =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <nav
      className="sticky top-4 z-30 mx-auto w-[min(92%,72rem)]"
      style={{
        transform: oculto ? 'translateY(-140%)' : 'translateY(0)',
        transition: prefiereMenosMovimiento ? 'none' : 'transform 260ms var(--ease-apple)',
      }}
    >
      <div className="flex items-center justify-between gap-[0.8rem] rounded-glass glass-surface px-[1rem] py-[0.6rem]">
        <Marca tamano="condensado" />
        <div className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-[0.6rem] py-[0.3rem] font-body text-xs text-concreto-oscuro transition-colors duration-200 hover:bg-white/40 hover:text-verde-oscuro"
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
          className="glass-surface glass-surface--strong mt-2 grid grid-cols-2 gap-1 rounded-glass p-[0.6rem] md:hidden"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="rounded-full px-[0.6rem] py-[0.4rem] font-body text-xs text-concreto-oscuro transition-colors duration-200 hover:bg-white/40 hover:text-verde-oscuro"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
