import { CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CampanitaNotificaciones } from '../features/notifications/components/CampanitaNotificaciones'
import { AyudaPaginaModal } from './AyudaPaginaModal'
import { SECCIONES_SIDEBAR } from './sidebarItems'

// Etiquetas de rutas que no viven en el nav de la sidebar (home, catálogo,
// ruta temporal de dev) — ver App.tsx para la lista completa de rutas.
const ETIQUETA_RUTA_EXTRA: Record<string, string> = {
  '/': 'Inicio',
  '/design-system': 'Design System',
  '/dev/componentes': 'Dev — Componentes',
}

const ITEMS_SIDEBAR = SECCIONES_SIDEBAR.flatMap((seccion) => seccion.items)

// Match por prefijo (más largo primero) — cubre rutas con parámetro como
// /nuevas-mediciones/:fichaId o /migracion/:fileId sin necesitar useParams.
function etiquetaDeRuta(pathname: string): string {
  if (ETIQUETA_RUTA_EXTRA[pathname]) return ETIQUETA_RUTA_EXTRA[pathname]
  const item = [...ITEMS_SIDEBAR]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((i) => pathname === i.ruta || pathname.startsWith(`${i.ruta}/`))
  return item?.etiqueta ?? 'EVA'
}

// Topbar persistente del shell (MainLayout) — breadcrumb + notificaciones.
// El logout ya vive en el footer de la Sidebar, así que acá no se repite.
export function TopBar() {
  const { pathname } = useLocation()
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-arena bg-white px-3 sm:h-16 sm:px-6">
      <p className="font-body text-sm text-concreto">
        <span className="text-concreto">EVA</span>
        <span className="mx-1.5 text-concreto/50">›</span>
        <span className="font-semibold text-concreto-oscuro">{etiquetaDeRuta(pathname)}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAyudaAbierta(true)}
          className="grid h-9 w-9 place-items-center rounded-full text-concreto transition hover:bg-arena hover:text-verde-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verde-claro"
          aria-label={`Ayuda sobre ${etiquetaDeRuta(pathname)}`}
          title="Ayuda de esta pestaña"
        >
          <CircleHelp size={19} aria-hidden />
        </button>
        <CampanitaNotificaciones />
      </div>
      {ayudaAbierta && <AyudaPaginaModal pathname={pathname} onCerrar={() => setAyudaAbierta(false)} />}
    </header>
  )
}
