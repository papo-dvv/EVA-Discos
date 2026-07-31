// Selector segmentado Y/O (styles.md §4.2, clase .eva-segmento) — extraído de
// PanelFiltros de mediciones para reutilizarlo tal cual en cualquier panel de
// filtros combinables (ver también wear-rate/components/PanelFiltrosWearRate).
type Props = {
  valor: 'AND' | 'OR'
  onCambiar: (valor: 'AND' | 'OR') => void
  className?: string
}

export function ModoCombinacionToggle({ valor, onCambiar, className = '' }: Props) {
  return (
    <div className={`eva-segmento ${className}`.trim()} role="group" aria-label="Modo de combinación">
      {(['AND', 'OR'] as const).map((modo) => (
        <button
          key={modo}
          type="button"
          className="eva-segmento__opcion"
          data-active={valor === modo ? 'true' : undefined}
          onClick={() => onCambiar(modo)}
        >
          {modo === 'AND' ? 'Y (todos)' : 'O (cualquiera)'}
        </button>
      ))}
    </div>
  )
}
