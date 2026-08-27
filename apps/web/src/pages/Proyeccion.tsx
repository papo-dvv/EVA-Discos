import { GlassSurface } from '../components/GlassSurface'
import { EstadoActualizacionModulo } from '../features/module-snapshot/components/EstadoActualizacionModulo'
import { AnalisisProyeccion } from '../features/projection/components/AnalisisProyeccion'
import { ProyeccionGraficoBarras } from '../features/projection/components/ProyeccionGraficoBarras'

// Proyección de Reperfilado y Cambio — antes tenía un toggle de página
// Gráfico de Barras/Tabla; la tabla se mudó a Configuración (ver
// ProyeccionTabla.tsx, mismo motivo que Relación de bogies/Migración: es una
// herramienta de detalle fila-por-fila, no un tablero). Acá solo queda el
// gráfico (siempre fleet-wide) + el bloque de Análisis debajo.
export function Proyeccion() {
  return (
    <div className="px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-[75rem]">
        <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
            Proyección de reperfilado y cambio
          </h1>
          <EstadoActualizacionModulo modulo="proyeccion" />
        </GlassSurface>

        <ProyeccionGraficoBarras />
        <AnalisisProyeccion />
      </div>
    </div>
  )
}
