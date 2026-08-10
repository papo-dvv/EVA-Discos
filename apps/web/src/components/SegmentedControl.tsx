import type { ReactNode } from 'react'
import { WarningTooltip } from './WarningTooltip'

// Toggle segmentado genérico de N opciones (clase .eva-segmento) — mismo
// patrón visual que ModoCombinacionToggle (AND/OR) y el toggle Global/Por
// tren de TasaDesgaste, generalizado a cualquier lista de opciones (ej. el
// selector de periodo de Trazabilidad, con 5 opciones, o el toggle de Motivo
// de Nuevas Mediciones con opciones "Próximamente" deshabilitadas).
type Opcion<T extends string> = {
  valor: T
  etiqueta: string
  // Ambos opcionales: una opción deshabilitada sin tooltip simplemente no
  // responde al clic (ej. a futuro); con tooltip, además explica por qué.
  deshabilitada?: boolean
  tooltip?: ReactNode
  // 'arriba' (default de WarningTooltip) se recorta si el control vive cerca
  // del borde superior de su propio GlassSurface (`overflow: hidden` — ver
  // styles.md §4): el toggle de Motivo de Nuevas Mediciones, pegado al
  // borde superior de su tarjeta, necesita 'abajo'.
  tooltipPosicion?: 'arriba' | 'abajo'
}

type Props<T extends string> = {
  opciones: Opcion<T>[]
  // undefined = ninguna opción preseleccionada (ej. el toggle de Motivo de
  // Nuevas Mediciones, que arranca sin valor por defecto) — ninguna opción
  // se marca data-active hasta que el usuario elige una.
  valor: T | undefined
  onCambiar: (valor: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({ opciones, valor, onCambiar, ariaLabel, className = '' }: Props<T>) {
  return (
    <div className={`eva-segmento ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {opciones.map((o) => {
        const boton = (
          <button
            key={o.valor}
            type="button"
            className="eva-segmento__opcion"
            data-active={valor === o.valor ? 'true' : undefined}
            // aria-disabled, NUNCA el atributo `disabled`: un botón nativo
            // disabled no dispara mouseenter/focus ni en él ni en sus
            // ancestros (así el WarningTooltip que lo envuelve — ver
            // `tooltip` — jamás llegaría a mostrarse por hover/teclado).
            aria-disabled={o.deshabilitada || undefined}
            onClick={() => {
              if (!o.deshabilitada) onCambiar(o.valor)
            }}
          >
            {o.etiqueta}
          </button>
        )
        return o.tooltip ? (
          <WarningTooltip key={o.valor} texto={o.tooltip} posicion={o.tooltipPosicion}>
            {boton}
          </WarningTooltip>
        ) : (
          boton
        )
      })}
    </div>
  )
}
