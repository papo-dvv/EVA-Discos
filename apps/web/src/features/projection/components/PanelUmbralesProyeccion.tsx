import { Settings2 } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import { useSystemParams } from '../../system-params/queries'

const UMBRALES = [
  {
    clave: 'h_umbral_reperfilado',
    etiqueta: 'Umbral de reperfilado',
    unidad: 'H',
  },
  {
    // El motor de Proyección recibe este valor como rdUmbralCambioProyeccion.
    clave: 'rd_umbral_seguimiento',
    etiqueta: 'Umbral de cambio',
    unidad: 'Rd',
  },
] as const

// Referencia de solo lectura para la propia pantalla de Proyección. Los
// valores se administran en Parámetros del sistema; acá se muestran los que
// realmente consume el cálculo para evitar que la fórmula quede aislada de
// su configuración vigente.
export function PanelUmbralesProyeccion() {
  const params = useSystemParams()
  const porClave = new Map((params.data ?? []).map((param) => [param.clave, param]))

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <div className="mb-1 flex items-center gap-2">
        <Settings2 size={16} className="text-verde-oscuro" aria-hidden />
        <h3 className="font-display text-base font-semibold text-concreto-oscuro">Umbrales de proyección</h3>
      </div>
      <p className="mb-3 font-body text-xs text-concreto">Valores configurables aplicados al cálculo actual.</p>

      {params.isLoading ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : params.isError ? (
        <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudieron cargar los umbrales.
        </p>
      ) : (
        <dl className="space-y-2.5">
          {UMBRALES.map((umbral) => {
            const param = porClave.get(umbral.clave)
            return (
              <div key={umbral.clave} className="flex items-baseline justify-between gap-3 border-b border-concreto/10 pb-2.5 last:border-0 last:pb-0">
                <dt className="font-body text-sm text-concreto-oscuro">{umbral.etiqueta}</dt>
                <dd className="shrink-0 font-data text-base font-semibold text-verde-oscuro">
                  {param?.valor ?? '—'} <span className="text-xs font-medium text-concreto">{umbral.unidad}</span>
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </GlassSurface>
  )
}
