import { useState } from 'react'

// Paginación numérica (1 2 3 … con salto directo) + atajos Anterior/Siguiente.
// Usa totalPaginas del backend.
type Props = {
  page: number
  totalPaginas: number
  onPage: (n: number) => void
}

// Devuelve la secuencia de páginas a mostrar con elipsis: siempre 1 y la
// última, la actual ±1, y '…' donde hay saltos.
function secuencia(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>([1, total, page, page - 1, page + 1])
  const paginas = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const salida: (number | '…')[] = []
  let previa = 0
  for (const n of paginas) {
    if (previa && n - previa > 1) salida.push('…')
    salida.push(n)
    previa = n
  }
  return salida
}

export function PaginacionNumerica({ page, totalPaginas, onPage }: Props) {
  const [salto, setSalto] = useState('')

  function irASalto() {
    const n = Number(salto)
    if (Number.isInteger(n) && n >= 1 && n <= totalPaginas) {
      onPage(n)
      setSalto('')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="eva-pagina"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        ←
      </button>

      {secuencia(page, totalPaginas).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="eva-pagina eva-pagina--elipsis">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className="eva-pagina"
            data-active={n === page ? 'true' : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        className="eva-pagina"
        onClick={() => onPage(Math.min(totalPaginas, page + 1))}
        disabled={page >= totalPaginas}
      >
        →
      </button>

      {/* Salto directo */}
      <div className="ml-2 flex items-center gap-1.5">
        <div className="w-20">
          <input
            type="number"
            min={1}
            max={totalPaginas}
            value={salto}
            onChange={(e) => setSalto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') irASalto()
            }}
            placeholder="Ir a…"
            aria-label="Ir a la página"
            className="glass-field h-[2.125rem] px-3 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          className="eva-pagina"
          onClick={irASalto}
          disabled={!salto}
        >
          Ir
        </button>
      </div>

      <span className="ml-1 font-body text-xs text-concreto">
        de <span className="font-data">{totalPaginas}</span>
      </span>
    </div>
  )
}
