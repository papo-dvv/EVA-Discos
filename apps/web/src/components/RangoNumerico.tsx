// Par de inputs numéricos mín/máx (styles.md §4.2) — extraído de
// PanelFiltros de mediciones para reutilizarlo tal cual en cualquier panel de
// filtros con rangos numéricos (ver también wear-rate/components/PanelFiltrosWearRate).
type Props = {
  label: string
  valorMin: string
  valorMax: string
  onCambiarMin: (valor: string) => void
  onCambiarMax: (valor: string) => void
  disabled?: boolean
}

export function RangoNumerico({ label, valorMin, valorMax, onCambiarMin, onCambiarMax, disabled }: Props) {
  return (
    <div>
      <p className="mb-1 font-body text-xs text-concreto-oscuro">{label}</p>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="any"
          placeholder="mín"
          value={valorMin}
          onChange={(e) => onCambiarMin(e.target.value)}
          disabled={disabled}
          aria-label={`${label} mínimo`}
          className="glass-field w-full px-2.5 py-1.5 text-right font-data text-sm"
        />
        <span className="font-body text-xs text-concreto">–</span>
        <input
          type="number"
          step="any"
          placeholder="máx"
          value={valorMax}
          onChange={(e) => onCambiarMax(e.target.value)}
          disabled={disabled}
          aria-label={`${label} máximo`}
          className="glass-field w-full px-2.5 py-1.5 text-right font-data text-sm"
        />
      </div>
    </div>
  )
}
