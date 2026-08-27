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

      <PanelParametros soloTodos />
    </div>
  )
}
