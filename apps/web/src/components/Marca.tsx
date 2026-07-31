// Wordmark persistente (styles.md §1.1): "EVA" siempre protagonista,
// la línea de contexto nunca compite en peso visual (ratio mínimo 3:1).
type MarcaProps = {
  tono?: 'oscuro' | 'sobreVerde'
  tamano?: 'normal' | 'condensado'
}

export function Marca({ tono = 'oscuro', tamano = 'normal' }: MarcaProps) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`font-display font-bold tracking-tight ${tamano === 'condensado' ? 'text-base' : 'text-xl'} ${
          tono === 'oscuro' ? 'text-concreto-oscuro' : 'text-verde-oscuro'
        }`}
      >
        EVA
      </span>
      <span
        className={`font-body text-[11px] uppercase tracking-[0.14em] ${
          tono === 'oscuro' ? 'text-concreto' : 'text-verde-oscuro/70'
        }`}
      >
        de Línea 1 de Lima
      </span>
    </div>
  )
}
