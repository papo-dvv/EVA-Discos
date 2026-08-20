import { Outlet, useLocation } from 'react-router-dom'
import { FondoEngranajes } from './FondoEngranajes'
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
    <div className="flex h-svh overflow-hidden bg-arena-suave">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto">
          <FondoEngranajes className="min-h-full">
            {/* key=pathname: remonta en cada navegación para repetir la
                entrada fade+slide (§4) sin depender de framer-motion. Vive
                en un wrapper aparte de FondoEngranajes para que los
                engranajes NO se re-generen (mismo PRNG, misma posición) en
                cada cambio de ruta — solo el contenido se anima. */}
            <div key={pathname} className="eva-entrada-ruta">
              <Outlet />
            </div>
          </FondoEngranajes>
        </main>
      </div>
    </div>
  )
}
