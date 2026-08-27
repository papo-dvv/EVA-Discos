import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { GlassSurface } from './GlassSurface'
import { Marca } from './Marca'
import { SECCIONES_SIDEBAR } from './sidebarItems'

const CLAVE_COLAPSADA = 'eva.sidebar.colapsada'
export const EVENTO_COLAPSAR_SIDEBAR = 'eva:sidebar-colapsar'

// Sidebar persistente del shell (MainLayout) — rediseñada calcando la
// composición cinemática de EVA-Aldy (ver styles-eva/sidebar-styles.md):
// header con logo + wordmark, toggle circular flotante en el borde
// derecho, items con bordes redondeados 22px + indicador activo animado,
// footer con GlassSurface propio (Liquid Glass de EVA, no el de Aldy).
// Agrupación de secciones sigue siendo la propia de EVA (sidebarItems.ts),
// no la genérica Operación/Análisis/Administración de Aldy.
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
  const secciones = SECCIONES_SIDEBAR.map((seccion) => ({
    ...seccion,
    items: seccion.items.filter((item) => !item.soloAdministrador || rol === 'administrador'),
  })).filter((seccion) => seccion.items.length > 0)

  return (
    <aside
      className={`metro-sidebar-cinematic relative z-30 flex h-full shrink-0 flex-col overflow-visible transition-[width] duration-500 ease-out ${
        colapsada ? 'w-20' : 'w-64'
      }`}
      style={{ boxShadow: '8px 0 32px rgba(0, 0, 0, 0.28)' }}
      aria-label="Navegación principal"
    >
      {/* Header: logo + wordmark */}
      <div className={`relative z-10 flex h-20 shrink-0 items-center ${colapsada ? 'justify-center px-2' : 'px-6'}`}>
        <Link to="/" className="flex min-w-0 items-center gap-3" title="Ir a Inicio">
          <img
            src="/images/linea1logo.png"
            alt="EVA — Línea 1 de Lima"
            className="h-10 w-10 shrink-0 object-contain"
          />
          {!colapsada && (
            <div className="min-w-0">
              <Marca tono="claro" tamano="condensado" />
            </div>
          )}
        </Link>
      </div>

      {/* Toggle circular flotante, superpuesto al borde derecho */}
      <button
        type="button"
        onClick={() => setColapsada((v) => !v)}
        aria-label={colapsada ? 'Expandir navegación' : 'Colapsar navegación'}
        title={colapsada ? 'Expandir navegación' : 'Colapsar navegación'}
        className="absolute right-0 top-1/2 z-50 inline-flex h-10 w-10 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-black text-white shadow-[0_18px_34px_rgba(0,0,0,0.45)] transition-all duration-300 hover:scale-105 hover:bg-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-institucional/60"
      >
        {colapsada ? <ChevronRight className="h-5 w-5" aria-hidden /> : <ChevronLeft className="h-5 w-5" aria-hidden />}
      </button>

      <nav className="scrollbar-hidden relative z-10 flex-1 overflow-y-auto px-4 py-2">
        {secciones.map((seccion, idx) => (
          <div key={seccion.titulo} className={idx > 0 ? 'mt-4' : undefined}>
            {!colapsada && (
              <p className="mb-1.5 px-4 font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                {seccion.titulo}
              </p>
            )}
            <div className="space-y-1.5">
              {seccion.items.map((item) => (
                <NavLink
                  key={item.ruta}
                  to={item.ruta}
                  title={colapsada ? item.etiqueta : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-[22px] border font-body text-sm font-medium transition-all duration-300 ease-out will-change-transform ${
                      colapsada ? 'mx-auto h-12 w-12 justify-center' : 'gap-3 px-4 py-3'
                    } ${
                      isActive
                        ? 'translate-x-1 border-white/20 bg-white/10 text-white shadow-[0_10px_24px_rgba(5,150,105,0.20)] backdrop-blur'
                        : 'border-transparent text-white/65 hover:translate-x-1 hover:border-transparent hover:bg-white/6 hover:text-white hover:shadow-[0_8px_20px_rgba(0,0,0,0.20)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !colapsada && (
                        <span
                          aria-hidden
                          className="eva-sidebar-linea-activa absolute right-full top-1/2 h-0.5 w-8 rounded-full bg-estado-ok shadow-[0_0_14px_rgba(16,185,129,0.8)]"
                        />
                      )}
                      <item.icono
                        size={20}
                        aria-hidden
                        className={`shrink-0 transition-colors ${
                          isActive ? 'text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.55)]' : 'text-white/65 group-hover:text-white'
                        }`}
                      />
                      {!colapsada && <span className="truncate">{item.etiqueta}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: usuario + cerrar sesión, envuelto en Liquid Glass propio de EVA */}
      <div className={`relative z-10 border-t border-white/10 ${colapsada ? 'flex justify-center p-3' : 'p-4'}`}>
        <GlassSurface
          fuerte
          className={`rounded-[18px] transition-all duration-300 hover:-translate-y-0.5 ${colapsada ? 'w-fit' : 'w-full'}`}
        >
          <div className={`flex items-center ${colapsada ? 'justify-center p-2' : 'gap-3 p-3'}`}>
            {!colapsada && sesion && (
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-xs font-semibold text-white">{sesion.usuario.nombresCompletos}</p>
                <p className="truncate font-body text-[11px] text-white/55">{sesion.usuario.rol}</p>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        </GlassSurface>
      </div>
    </aside>
  )
}
