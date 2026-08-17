import { Settings2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { GlassSurface } from '../../../components/GlassSurface'
import type { SystemParamItem } from '../../system-params/api'
import { FilaParametro } from '../../system-params/components/FilaParametro'
import { useSystemParams } from '../../system-params/queries'
import { claveFilaConEstado, useConfirmacionParametro } from '../../system-params/useConfirmacionParametro'

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
  {
    clave: 'reperfilado_descuento_rd',
    etiqueta: 'Descuento de reperfilado',
    unidad: 'Rd',
  },
] as const

// Referencia de solo lectura para la propia pantalla de Proyección. Los
// valores se administran en Parámetros del sistema; acá se muestran los que
// realmente consume el cálculo para evitar que la fórmula quede aislada de
// su configuración vigente.
export function PanelUmbralesProyeccion() {
  const queryClient = useQueryClient()
  const params = useSystemParams()
  const { actualizar, confirmando, setConfirmando, confirmar } = useConfirmacionParametro(() =>
    queryClient.invalidateQueries({ queryKey: ['projection'] }),
  )
  const porClave = new Map((params.data ?? []).map((param) => [param.clave, param]))
  const umbrales = UMBRALES.map((umbral) => ({ ...umbral, param: porClave.get(umbral.clave) })).filter(
    (umbral): umbral is (typeof UMBRALES)[number] & { param: SystemParamItem } => umbral.param !== undefined,
  )

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
        <div className="space-y-3">
          {umbrales.map(({ clave, etiqueta, unidad, param }) => {
            return (
              <div key={clave} className="border-b border-concreto/10 pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <p className="font-body text-sm font-medium text-concreto-oscuro">{etiqueta}</p>
                  <span className="font-data text-xs text-concreto">{unidad}</span>
                </div>
                <FilaParametro
                  key={claveFilaConEstado(param, actualizar)}
                  param={param}
                  onGuardar={(nuevo) => setConfirmando({ clave: param.clave, anterior: param.valor, nuevo })}
                />
              </div>
            )
          })}
        </div>
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar cambio de umbral"
          textoConfirmar="Sí, actualizar"
          onConfirm={confirmar}
          onCerrar={() => setConfirmando(null)}
          mensaje={
            <>
              ¿Seguro que quieres cambiar <span className="font-data">{confirmando.clave}</span> de{' '}
              <b className="font-data">{confirmando.anterior}</b> a <b className="font-data">{confirmando.nuevo}</b>?
              Esto recalcula las proyecciones de toda la flota.
            </>
          }
        />
      )}
    </GlassSurface>
  )
}
