import { useEffect, useRef, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { VirtualList } from '../../../components/VirtualList'
import type { PuntoSerieTrazabilidad } from '../types'
import { COLOR_EXCLUIDO } from './chart-shared'

type Props = {
  puntos: PuntoSerieTrazabilidad[] // ya filtrados a estado === 'excluido'
}

// Los puntos excluidos ya NO se dibujan como marcador en el plano principal
// (su valor crudo puede ser órdenes de magnitud más grande que el resto —
// deformaba el eje Y de todo el gráfico). Este badge es su único rastro
// visual: un contador que, al abrirse, lista fecha + valor crudo exacto de
// cada uno — mismo patrón de popover (clic afuera / Escape cierra) que
// MultiSelect/GlassSelect/GlassDatePicker.
export function IndicadorExcluidos({ puntos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
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

  if (puntos.length === 0) return null

  const altoLista = Math.min(Math.max(puntos.length, 1) * 34, 220)

  return (
    <div ref={contenedor} className="relative mb-3 inline-block">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 font-body text-xs transition-colors hover:bg-white/60"
        style={{
          borderColor: `color-mix(in srgb, ${COLOR_EXCLUIDO} 40%, transparent)`,
          color: COLOR_EXCLUIDO,
        }}
      >
        <span aria-hidden>✕</span>
        {puntos.length} excluido{puntos.length === 1 ? '' : 's'} fuera de escala — ver detalle
        <span className="text-concreto">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <GlassSurface fuerte className="absolute left-0 z-30 mt-2 w-72 rounded-glass-sm p-2">
          <p className="mb-1 px-1.5 py-1 font-body text-[0.6875rem] text-concreto">
            Excluidos del gráfico para no deformar la escala — quedan fuera del consenso de extremo.
          </p>
          <div className="flex items-center justify-between px-2 pb-1 font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
            <span>Fecha</span>
            <span>Tasa mensual cruda</span>
          </div>
          <VirtualList
            items={puntos}
            alto={altoLista}
            estimateSize={34}
            getKey={(p, i) => `${p.fecha}-${i}`}
            ariaLabel="Puntos excluidos, fuera de escala"
            renderItem={(p) => (
              <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
                <span className="font-body text-xs text-concreto-oscuro">{p.fecha}</span>
                <span className="font-data text-xs" style={{ color: COLOR_EXCLUIDO }}>
                  {p.tasaMensualCruda.toFixed(4)}
                </span>
              </div>
            )}
          />
        </GlassSurface>
      )}
    </div>
  )
}
