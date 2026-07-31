import { useEffect, useMemo, useRef, useState } from 'react'
import { GlassSurface } from './GlassSurface'
import { VirtualList } from './VirtualList'

// Selector multi-opción glass. El panel usa <VirtualList> para la lista de
// opciones (funciona igual con listas cortas o largas) y un buscador cuando hay
// muchas. Cierra al clic fuera o Escape.
type MultiSelectProps = {
  label: string
  opciones: string[]
  seleccion: string[]
  onCambiar: (valores: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MultiSelect({
  label,
  opciones,
  seleccion,
  onCambiar,
  placeholder = 'Todos',
  disabled = false,
  className = '',
}: MultiSelectProps) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedor = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return q ? opciones.filter((o) => o.toLowerCase().includes(q)) : opciones
  }, [opciones, busqueda])

  const seleccionSet = useMemo(() => new Set(seleccion), [seleccion])

  function alternar(valor: string) {
    if (seleccionSet.has(valor)) onCambiar(seleccion.filter((v) => v !== valor))
    else onCambiar([...seleccion, valor])
  }

  const resumen =
    seleccion.length === 0
      ? placeholder
      : seleccion.length <= 2
        ? seleccion.join(', ')
        : `${seleccion.length} seleccionados`

  const altoLista = Math.min(Math.max(filtradas.length, 1) * 38, 240)

  return (
    <div ref={contenedor} className={`relative ${className}`.trim()}>
      <label className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-white/55 px-4 py-2.5 text-left font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/70 disabled:opacity-50"
      >
        <span className={seleccion.length === 0 ? 'text-concreto' : ''}>{resumen}</span>
        <span className="flex items-center gap-2">
          {seleccion.length > 0 && (
            <span className="rounded-full bg-verde-claro px-2 py-0.5 font-data text-xs text-verde-oscuro">
              {seleccion.length}
            </span>
          )}
          <span className="text-concreto">{abierto ? '▲' : '▼'}</span>
        </span>
      </button>

      {abierto && (
        <GlassSurface
          fuerte
          className="absolute left-0 right-0 z-30 mt-2 rounded-glass-sm p-2"
        >
          {opciones.length > 8 && (
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Filtrar…"
              className="glass-field mb-2"
            />
          )}
          {filtradas.length === 0 ? (
            <p className="px-2 py-3 text-center font-body text-sm text-concreto">
              Sin opciones.
            </p>
          ) : (
            <VirtualList
              items={filtradas}
              alto={altoLista}
              estimateSize={38}
              getKey={(o) => o}
              ariaLabel={label}
              renderItem={(opcion) => {
                const marcado = seleccionSet.has(opcion)
                return (
                  <button
                    type="button"
                    onClick={() => alternar(opcion)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-body text-sm text-concreto-oscuro transition-colors hover:bg-white/60"
                  >
                    <span
                      aria-hidden
                      className={`flex h-[1.125rem] w-[1.125rem] flex-shrink-0 items-center justify-center rounded-full border text-[0.65rem] transition-colors ${
                        marcado
                          ? 'border-verde-institucional bg-verde-institucional text-white'
                          : 'border-concreto/40 bg-white/60'
                      }`}
                    >
                      {marcado ? '✓' : ''}
                    </span>
                    <span className="truncate">{opcion}</span>
                  </button>
                )
              }}
            />
          )}
          {seleccion.length > 0 && (
            <button
              type="button"
              onClick={() => onCambiar([])}
              className="mt-1 w-full rounded-xl px-2.5 py-1.5 text-left font-body text-xs text-concreto transition-colors hover:bg-white/60"
            >
              Limpiar selección
            </button>
          )}
        </GlassSurface>
      )}
    </div>
  )
}
