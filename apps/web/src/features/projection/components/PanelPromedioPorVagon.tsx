import { GlassSurface } from '../../../components/GlassSurface'
import { Widget } from '../../../components/Widget'
import type { PromedioPorVagon } from '../types'

type Props = {
  datos?: PromedioPorVagon[]
  cargando: boolean
}

// 6 tarjetas compactas, una por tipo de coche (MA1/MB1/MB3/REM/MB2/MA2, ya en
// orden físico real — lo devuelve así el backend), con la tasa promedio de
// desgaste usada como base del modelo de proyección de ese tipo. Sin
// `estado` (colores OK/Seguimiento/Cambio/Crítico): es una tasa, no un
// estado de salud de disco — mismo criterio que la tarjeta de Asimetría en
// Trazabilidad.
export function PanelPromedioPorVagon({ datos, cargando }: Props) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">
        Promedio por tipo de coche
      </h3>
      <p className="mb-3 font-body text-xs text-concreto">
        Tasa de desgaste (mm/mes) usada como base de la proyección, fleet-wide.
      </p>

      {cargando ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {(datos ?? []).map((d) => (
            <Widget key={d.tipoCoche} tamano="s" etiqueta={d.tipoCoche}>
              {d.tasaPromedio !== null ? (
                <div className="eva-widget__valor font-data">{d.tasaPromedio.toFixed(4)}</div>
              ) : (
                <p className="font-body text-xs text-concreto">— Datos insuficientes</p>
              )}
            </Widget>
          ))}
        </div>
      )}
    </GlassSurface>
  )
}
