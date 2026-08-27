import { ClipboardList, Database, FolderUp, Table2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../components/GlassSurface'
import { PanelParametros } from '../features/system-params/components/PanelParametros'

// Punto único de edición de parámetros del sistema — centraliza los paneles
// que antes vivían repartidos en Mediciones/Tasa de desgaste/Trazabilidad/
// Proyección (ver PanelParametros.tsx, prop `soloTodos`). Solo administrador
// (RolesGuard en el backend de /system-params; acá se oculta del sidebar).
export function Configuracion() {
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
        <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Configuración</h1>
        <p className="mt-1 max-w-xl font-body text-sm text-concreto">
          Parámetros configurables del sistema, agrupados por módulo.
        </p>
      </div>

      {/* Herramientas que antes tenían ítem/vista propia en el sidebar — se
          mudaron acá para no saturar el nav, no porque hayan pasado a ser
          "parámetros"; por eso van en tarjetas de acceso, separadas del
          panel de PanelParametros de abajo. Relación de bogies/Migración
          tenían ítem propio; las tablas de Proyección/Mediciones eran una
          vista dentro de sus páginas (toggle Gráfico/Tabla y Tarjetas/Tabla
          respectivamente). */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/relacion-bogies" className="block">
          <GlassSurface fuerte elevar className="flex items-start gap-3 rounded-glass p-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white">
              <Database size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-concreto-oscuro">Relación de bogies</p>
              <p className="mt-0.5 font-body text-xs text-concreto">Catálogo de bogies, series y ejes por tren.</p>
            </div>
          </GlassSurface>
        </Link>
        <Link to="/migracion" className="block">
          <GlassSurface fuerte elevar className="flex items-start gap-3 rounded-glass p-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white">
              <FolderUp size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-concreto-oscuro">Migración</p>
              <p className="mt-0.5 font-body text-xs text-concreto">Carga masiva del histórico de mediciones desde Excel.</p>
            </div>
          </GlassSurface>
        </Link>
        <Link to="/proyeccion/tabla" className="block">
          <GlassSurface fuerte elevar className="flex items-start gap-3 rounded-glass p-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white">
              <Table2 size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-concreto-oscuro">Tabla de Proyección</p>
              <p className="mt-0.5 font-body text-xs text-concreto">Detalle fila por fila de la proyección de reperfilado y cambio.</p>
            </div>
          </GlassSurface>
        </Link>
        <Link to="/mediciones/tabla" className="block">
          <GlassSurface fuerte elevar className="flex items-start gap-3 rounded-glass p-4 transition-transform hover:-translate-y-0.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white">
              <ClipboardList size={18} aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-concreto-oscuro">Tabla de Mediciones</p>
              <p className="mt-0.5 font-body text-xs text-concreto">Detalle fila por fila de las mediciones confirmadas.</p>
            </div>
          </GlassSurface>
        </Link>
      </div>

      <PanelParametros soloTodos />
    </div>
  )
}
