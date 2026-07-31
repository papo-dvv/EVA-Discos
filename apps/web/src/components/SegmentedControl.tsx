// Toggle segmentado genérico de N opciones (clase .eva-segmento) — mismo
// patrón visual que ModoCombinacionToggle (AND/OR) y el toggle Global/Por
// tren de TasaDesgaste, generalizado a cualquier lista de opciones (ej. el
// selector de periodo de Trazabilidad, con 5 opciones).
type Opcion<T extends string> = { valor: T; etiqueta: string }

type Props<T extends string> = {
  opciones: Opcion<T>[]
  valor: T
  onCambiar: (valor: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({ opciones, valor, onCambiar, ariaLabel, className = '' }: Props<T>) {
  return (
    <div className={`eva-segmento ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="eva-segmento__opcion"
          data-active={valor === o.valor ? 'true' : undefined}
          onClick={() => onCambiar(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}
