// Wordmark persistente (styles.md §1.1): "EVA" siempre protagonista,
// la línea de contexto nunca compite en peso visual (ratio mínimo 3:1).
// `claro` es el tono sobre la sidebar oscura cinemática (Sidebar.tsx) —
// blanco/verde claro en vez de los tonos oscuros pensados para fondos
// claros.
type MarcaProps = {
  tono?: 'oscuro' | 'sobreVerde' | 'claro'
  tamano?: 'normal' | 'condensado'
}

const TITULO_POR_TONO: Record<NonNullable<MarcaProps['tono']>, string> = {
  oscuro: 'text-concreto-oscuro',
  sobreVerde: 'text-verde-oscuro',
  claro: 'text-white',
}

const CONTEXTO_POR_TONO: Record<NonNullable<MarcaProps['tono']>, string> = {
  oscuro: 'text-concreto',
  sobreVerde: 'text-verde-oscuro/70',
  claro: 'text-verde-claro/70',
}

export function Marca({ tono = 'oscuro', tamano = 'normal' }: MarcaProps) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`font-display font-bold tracking-tight ${tamano === 'condensado' ? 'text-base' : 'text-xl'} ${TITULO_POR_TONO[tono]}`}
      >
        EVA
      </span>
      <span className={`font-body text-[11px] uppercase tracking-[0.14em] ${CONTEXTO_POR_TONO[tono]}`}>
        de Línea 1 de Lima
      </span>
    </div>
  )
}
