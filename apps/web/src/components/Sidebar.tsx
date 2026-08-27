import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SECCIONES_SIDEBAR } from './sidebarItems'

const CLAVE_COLAPSADA = 'eva.sidebar.colapsada'
export const EVENTO_COLAPSAR_SIDEBAR = 'eva:sidebar-colapsar'

// Sidebar persistente del shell (MainLayout) — styles.md §4: columna fija,
// siempre oscura (mismo fondo cinemático con o sin sesión), colapso
// 256px/80px persistido en localStorage. Reemplaza el nav flotante que
// antes vivía suelto dentro de Inicio.tsx.
export function Sidebar() {
  const { sesion, logout } = useAuth()
  const [colapsada, setColapsada] = useState(() => localStorage.getItem(CLAVE_COLAPSADA) === 'true')

  useEffect(() => {
    localStorage.setItem(CLAVE_COLAPSADA, String(colapsada))
  }, [colapsada])

  useEffect(() => {
    function colapsar() {
      setColapsada(true)
    }

    window.addEventListener(EVENTO_COLAPSAR_SIDEBAR, colapsar)
    return () => window.removeEventListener(EVENTO_COLAPSAR_SIDEBAR, colapsar)
  }, [])

  const rol = sesion?.usuario.rol

  return (
    // El fondo cinemático (con su propio overflow:hidden, ver tokens.css)
    // vive en una capa aparte de este <aside> a propósito: si el
    // overflow:hidden estuviera acá, recortaría el botón de colapso de
    // abajo, que sobresale un poco del borde derecho (-right-3).
    <aside
      className={`relative shrink-0 transition-[width] duration-300 ${colapsada ? 'w-[68px]' : 'w-[220px]'}`}
    >
      {/* Sin z-index negativo a propósito: un z negativo acá puede escapar
          el stacking context del <aside> y terminar detrás del <main>
          blanco de al lado en vez de solo detrás del contenido de la
          sidebar — el orden del DOM (este div antes que el contenido)
          alcanza para que quede atrás, sin tocar z-index. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#030504_0%,#030705_42%,#063a1d_76%,#087b2b_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.38),transparent_65%)]" />

      {/* relative (sin z-index): al ser también "posicionado" y venir
          DESPUÉS del fondo en el DOM, pinta encima de él — un div sin
          `position` pintaría por debajo aunque esté después en el DOM,
          porque los elementos posicionados sin z-index siempre van sobre
          los estáticos. */}
      <div className="relative flex h-full flex-col">
        <div className="flex h-[70px] items-center gap-2 border-b border-white/5 px-4">
          {/* linea1logo reemplaza el wordmark "EVA / de Línea 1 de Lima" solo
              acá (ver Marca.tsx, que sigue usándose tal cual en Login y otras
              pantallas) — clic navega a "/" (Inicio), el dashboard. */}
          <Link to="/" className="flex min-w-0 items-center gap-2" title="Ir a Inicio">
            <img
              src="/images/linea1logo.png"
              alt="Línea 1"
              className="h-9 w-9 shrink-0 object-contain"
            />
            {!colapsada && (
              <span className="min-w-0 leading-none">
                <span className="block truncate text-[13px] font-bold text-white">Metro Lima</span>
                <span className="mt-1 block text-[8px] font-medium text-white/55">Gestión</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {SECCIONES_SIDEBAR.map((seccion) => {
          const items = seccion.items.filter((item) => !item.soloAdministrador || rol === 'administrador')
          if (items.length === 0) return null
          return (
            <div key={seccion.titulo} className="mb-4">
              {!colapsada && (
                <p className="mb-1.5 px-2.5 font-body text-[9px] font-bold uppercase tracking-[0.15em] text-white/38">
                  {seccion.titulo}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.ruta}>
                    <NavLink
                      to={item.ruta}
                      // "/" (Dashboard) matchea por prefijo con TODAS las
                      // rutas si no se fija `end` — sin esto, quedaría
                      // marcado como activo en cualquier pantalla.
                      end={item.ruta === '/'}
                      title={colapsada ? item.etiqueta : undefined}
                      className={({ isActive }: { isActive: boolean }) =>
                        `flex min-h-9 items-center gap-3 rounded-xl border px-2.5 py-2 font-body text-[12px] transition-all ${
                          isActive
                            ? 'border-white/80 bg-white/[0.06] font-semibold text-white shadow-[0_0_22px_rgba(255,255,255,0.06)]'
                            : 'border-transparent text-white/65 hover:bg-white/5 hover:text-white'
                        } ${colapsada ? 'justify-center' : ''}`
                      }
                    >
                      <item.icono size={17} aria-hidden className="shrink-0" />
                      {!colapsada && <span className="truncate">{item.etiqueta}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="px-2.5 pb-3 pt-2">
        {!colapsada && sesion && (
          <div className="mb-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-emerald-700">
              {sesion.usuario.nombresCompletos.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-body text-[11px] font-semibold text-white">{sesion.usuario.nombresCompletos}</p>
              <p className="truncate font-body text-[9px] capitalize text-white/55">{sesion.usuario.rol}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          title="Cerrar sesión"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 font-body text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white ${
            colapsada ? 'justify-center' : ''
          }`}
        >
          <LogOut size={17} aria-hidden className="shrink-0" />
          {!colapsada && <span>Cerrar sesión</span>}
        </button>
      </div>
      </div>

      {/* z-20: sobresale del borde derecho del <aside> (-right-3) hacia el
          territorio de <main> — sin un z-index explícito, el contenido de
          la página (que también trae elementos posicionados, ver
          FondoEngranajes) puede terminar pintando encima en esa franja de
          ~12px de superposición y robarle los clics al botón. */}
      <button
        type="button"
        onClick={() => setColapsada((v) => !v)}
        aria-label={colapsada ? 'Expandir menú' : 'Colapsar menú'}
        className="absolute -right-3 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#020604] text-white/80 shadow-md transition-colors hover:text-white"
      >
        {colapsada ? <PanelLeftOpen size={13} aria-hidden /> : <PanelLeftClose size={13} aria-hidden />}
      </button>
    </aside>
  )
}
