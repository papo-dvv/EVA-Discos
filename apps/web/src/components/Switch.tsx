// Toggle único (styles.md §4.2, clase .eva-switch) — extraído de PanelFiltros
// de mediciones para reutilizarlo tal cual en cualquier filtro de un solo
// interruptor (ver también wear-rate/components/PanelFiltrosWearRate).
type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  ariaLabel?: string
  className?: string
}

export function Switch({ checked, onChange, label, ariaLabel, className = '' }: Props) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        className="eva-switch"
        data-on={checked ? 'true' : undefined}
        onClick={() => onChange(!checked)}
      >
        <span className="eva-switch__perilla" />
      </button>
      <span className="font-body text-sm text-concreto-oscuro">{label}</span>
    </label>
  )
}
