import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SECCIONES_SIDEBAR } from './sidebarItems'
import { Marca } from './Marca'

const CLAVE_COLAPSADA = 'eva.sidebar.colapsada'

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

  const rol = sesion?.usuario.rol

  return (
    // El fondo cinemático (con su propio overflow:hidden, ver tokens.css)
    // vive en una capa aparte de este <aside> a propósito: si el
    // overflow:hidden estuviera acá, recortaría el botón de colapso de
    // abajo, que sobresale un poco del borde derecho (-right-3).
    <aside
      className={`relative shrink-0 transition-[width] duration-300 ${colapsada ? 'w-20' : 'w-64'}`}
    >
      {/* Sin z-index negativo a propósito: un z negativo acá puede escapar
          el stacking context del <aside> y terminar detrás del <main>
          blanco de al lado en vez de solo detrás del contenido de la
          sidebar — el orden del DOM (este div antes que el contenido)
          alcanza para que quede atrás, sin tocar z-index. */}
      <div className="metro-sidebar-cinematic absolute inset-0" />

      {/* relative (sin z-index): al ser también "posicionado" y venir
          DESPUÉS del fondo en el DOM, pinta encima de él — un div sin
          `position` pintaría por debajo aunque esté después en el DOM,
          porque los elementos posicionados sin z-index siempre van sobre
          los estáticos. */}
      <div className="relative flex h-full flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          {colapsada ? (
            <span className="font-display text-xl font-bold tracking-tight text-white">E</span>
          ) : (
            <Marca tono="claro" tamano="condensado" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
        {SECCIONES_SIDEBAR.map((seccion) => {
          const items = seccion.items.filter((item) => !item.soloAdministrador || rol === 'administrador')
          if (items.length === 0) return null
          return (
            <div key={seccion.titulo} className="mb-5">
              {!colapsada && (
                <p className="mb-1.5 px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                  {seccion.titulo}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.ruta}>
                    <NavLink
                      to={item.ruta}
                      title={colapsada ? item.etiqueta : undefined}
                      className={({ isActive }: { isActive: boolean }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 font-body text-sm transition-all ${
                          isActive
                            ? 'translate-x-1 bg-sidebar-accent font-semibold text-white'
                            : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white'
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

      <div className="border-t border-sidebar-border px-3 py-3">
        {!colapsada && sesion && (
          <div className="mb-2 px-3">
            <p className="truncate font-body text-xs font-semibold text-white">{sesion.usuario.nombresCompletos}</p>
            <p className="truncate font-body text-[11px] text-sidebar-foreground/55">{sesion.usuario.rol}</p>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          title="Cerrar sesión"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 font-body text-sm text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-white ${
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
        className="absolute -right-3 top-16 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-[#0f172a] text-sidebar-foreground/80 shadow-md transition-colors hover:text-white"
      >
        {colapsada ? <PanelLeftOpen size={13} aria-hidden /> : <PanelLeftClose size={13} aria-hidden />}
      </button>
    </aside>
  )
}
