import { GlassSurface } from '../../../components/GlassSurface'
import { Widget } from '../../../components/Widget'
import type { WearRateSummary } from '../types'

// Panel de diagnóstico rápido: conteo de pares válidos vs. inválidos +
// desglose de los motivos de invalidez más frecuentes (mini-barras). "seguimiento"
// se reutiliza como tono de advertencia para "inválidos" — no es un estado del
// disco, así que nunca el rojo de Crítico (ver TablaWearRate/EstadoValidezChip).
type Props = {
  resumen?: WearRateSummary
  cargando: boolean
}

export function PanelResumenWearRate({ resumen, cargando }: Props) {
  const maxMotivo = resumen?.motivosFrecuentes.reduce((m, x) => Math.max(m, x.cantidad), 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Widget
          tamano="s"
          estado="ok"
          etiqueta="Pares válidos"
          valor={cargando ? '…' : (resumen?.paresValidos ?? 0)}
        />
        <Widget
          tamano="s"
          estado="seguimiento"
          etiqueta="Pares inválidos"
          valor={cargando ? '…' : (resumen?.paresInvalidos ?? 0)}
        />
      </div>

      <GlassSurface fuerte className="rounded-glass p-4">
        <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">
          Motivos de invalidez
        </h3>
        <p className="mb-3 font-body text-xs text-concreto">
          Más frecuentes entre los pares inválidos.
        </p>

        {cargando ? (
          <p className="font-body text-sm text-concreto">Cargando…</p>
        ) : !resumen || resumen.motivosFrecuentes.length === 0 ? (
          <p className="font-body text-sm text-concreto">
            {resumen && resumen.paresValidos + resumen.paresInvalidos > 0
              ? 'Sin pares inválidos — todos los cálculos son válidos.'
              : 'Todavía no hay pares calculados.'}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {resumen.motivosFrecuentes.map((m) => (
              <li key={m.motivo}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className="truncate font-body text-xs text-concreto-oscuro"
                    title={m.motivo}
                  >
                    {m.motivo}
                  </span>
                  <span className="flex-shrink-0 font-data text-xs text-concreto">{m.cantidad}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxMotivo > 0 ? (m.cantidad / maxMotivo) * 100 : 0}%`,
                      background: 'var(--color-estado-seguimiento)',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassSurface>
    </div>
  )
}
