import type { AjusteConsenso } from '../api'

// Aviso de la Regla B (ver ConsensoValidationService): un PATCH de percentil
// puede devolver 200 con ajustesConsenso no vacío — el cambio SÍ se guardó,
// pero el extremo inferior de alguna combinación de scope se corrigió solo.
// No es un error (tono "Seguimiento" de §6, NUNCA el rojo de error), así que
// no pasa por ConfirmDialog/extraerMensajeError. Compartido por
// PanelParametros y PanelMetodosTrazabilidad — mismo texto en los 2 lugares
// donde puede dispararse (cualquier PATCH a uno de los 4 percentiles).
type Props = {
  clave: string
  ajustes: AjusteConsenso[]
  onCerrar: () => void
}

export function AvisoAjusteConsenso({ clave, ajustes, onCerrar }: Props) {
  return (
    <div role="status" className="mb-3 rounded-xl border px-3 py-2.5" style={ESTILO_AVISO_AJUSTE}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-xs text-concreto-oscuro">
          ⚠ <b className="font-data">{clave}</b> se guardó. El consenso se ajustó automáticamente en{' '}
          {ajustes.length} {ajustes.length === 1 ? 'combinación' : 'combinaciones'}:{' '}
          {ajustes.map((a) => `${a.scope} (extremo inferior → ${a.epsilonAplicado})`).join('; ')}.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="flex-shrink-0 font-body text-xs text-concreto transition-colors hover:text-concreto-oscuro"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

const ESTILO_AVISO_AJUSTE = {
  borderColor: 'color-mix(in srgb, var(--color-estado-seguimiento) 45%, transparent)',
  background: 'color-mix(in srgb, var(--color-estado-seguimiento) 12%, transparent)',
}
