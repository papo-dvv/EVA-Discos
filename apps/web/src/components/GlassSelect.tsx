import { useEffect, useMemo, useRef, useState } from 'react'
import { GlassSurface } from './GlassSurface'
import { VirtualList } from './VirtualList'

// Selector glass de UNA sola opción (a diferencia de <MultiSelect>) — mismo
// lenguaje visual (GlassSurface, VirtualList, buscador si hay muchas
// opciones, cierre al clic fuera / Escape), pero para filtros donde el
// backend solo acepta un valor a la vez (ver TraceabilityScopeQueryDto:
// tren/tipoCoche/bogieCodigo son escalares, no arrays).
type Opcion = { valor: string; etiqueta: string }

type Props = {
  label: string
  opciones: Opcion[]
  seleccion?: string
  onCambiar: (valor: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function GlassSelect({
  label,
  opciones,
  seleccion,
  onCambiar,
  placeholder = 'Todos',
  disabled = false,
  className = '',
}: Props) {
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
    return q ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(q)) : opciones
  }, [opciones, busqueda])

  const seleccionada = opciones.find((o) => o.valor === seleccion)

  function elegir(valor: string | undefined) {
    onCambiar(valor)
    setAbierto(false)
    setBusqueda('')
  }

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
        <span className={seleccionada ? '' : 'text-concreto'}>{seleccionada?.etiqueta ?? placeholder}</span>
        <span className="text-concreto">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <GlassSurface fuerte className="absolute left-0 right-0 z-30 mt-2 rounded-glass-sm p-2">
          {opciones.length > 8 && (
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Filtrar…"
              className="glass-field mb-2"
            />
          )}

          <button
            type="button"
            onClick={() => elegir(undefined)}
            className="mb-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-body text-sm transition-colors hover:bg-white/60"
          >
            <span
              aria-hidden
              className={`flex h-[1.125rem] w-[1.125rem] flex-shrink-0 items-center justify-center rounded-full border text-[0.65rem] transition-colors ${
                seleccion === undefined
                  ? 'border-verde-institucional bg-verde-institucional text-white'
                  : 'border-concreto/40 bg-white/60'
              }`}
            >
              {seleccion === undefined ? '✓' : ''}
            </span>
            <span className="italic text-concreto">{placeholder}</span>
          </button>

          {filtradas.length === 0 ? (
            <p className="px-2 py-3 text-center font-body text-sm text-concreto">Sin opciones.</p>
          ) : (
            <VirtualList
              items={filtradas}
              alto={altoLista}
              estimateSize={38}
              getKey={(o) => o.valor}
              ariaLabel={label}
              renderItem={(opcion) => {
                const marcado = opcion.valor === seleccion
                return (
                  <button
                    type="button"
                    onClick={() => elegir(opcion.valor)}
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
                    <span className="truncate">{opcion.etiqueta}</span>
                  </button>
                )
              }}
            />
          )}
        </GlassSurface>
      )}
    </div>
  )
}
