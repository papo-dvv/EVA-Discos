import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

// Shell persistente de la app autenticada (styles.md §4): sidebar +
// topbar fijos, <main> como único elemento que scrollea. El fondo de
// engranajes cayendo (§7.1) vive acá, dentro de <main>, en vez de
// envolver cada página por separado como hacía PantallaFondo antes —
// las páginas ahora renderizan solo su contenido (ver App.tsx: rutas
// autenticadas anidadas bajo esta ruta padre).
export function MainLayout() {
  const { pathname } = useLocation()

  return (
    <div className="flex h-svh overflow-hidden bg-[#f3f6f8]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto bg-[#f3f6f8]">
            <div aria-hidden className="pointer-events-none fixed right-[-10rem] top-24 h-[30rem] w-[30rem] rounded-full bg-emerald-300/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none fixed bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-amber-200/20 blur-3xl" />
            {/* key=pathname: remonta en cada navegación para repetir la
                entrada fade+slide (§4) sin depender de framer-motion. Vive
                en un wrapper aparte de FondoEngranajes para que los
                engranajes NO se re-generen (mismo PRNG, misma posición) en
                cada cambio de ruta — solo el contenido se anima. */}
            <div key={pathname} className="eva-entrada-ruta relative">
              <Outlet />
            </div>
        </main>
      </div>
    </div>
  )
}
