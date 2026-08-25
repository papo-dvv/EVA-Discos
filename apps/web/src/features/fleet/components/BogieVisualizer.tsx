import type { FleetBogieDetalle, FleetDiscoDetalle } from '../types'
import { colorEstado, ESTADO_META } from './estadoVisual'

type Props = {
  bogie: FleetBogieDetalle
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
}

function formatoRd(rd: number | null): string {
  return rd === null ? 'Sin datos' : `Rd ${rd.toFixed(2)}`
}

function textoEstado(disco: FleetDiscoDetalle): string {
  if (!disco.estadoCalculado) return 'Sin datos'
  return ESTADO_META[disco.estadoCalculado].etiqueta
}

export function BogieVisualizer({ bogie, onSeleccionarDisco }: Props) {
  const ejes = bogie.ejes.slice(0, 2)

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 shadow-[inset_0_1px_0_white]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-concreto-oscuro">{bogie.bogie}</h3>
        <div className="flex flex-wrap justify-end gap-1.5">
          {ejes.map((eje) => (
            <span key={eje.eje} className="glass-chip px-2 py-0.5 text-[0.68rem]">
              Eje {eje.eje}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox="0 0 560 236"
        role="img"
        aria-label={`Bogie ${bogie.bogie}`}
        className="h-auto w-full overflow-visible"
      >
        <defs>
          <filter id={`shadow-${bogie.bogie}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.12" />
          </filter>
          <radialGradient id={`metal-${bogie.bogie}`} cx="38%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="72%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
        </defs>

        {ejes.map((eje, idx) => {
          const y = 34 + idx * 104
          const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo') ?? null
          const derecho = eje.discos.find((disco) => disco.lado === 'derecho') ?? null
          return (
            <g key={eje.eje}>
              <line x1="78" y1={y + 38} x2="482" y2={y + 38} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
              <circle cx="58" cy={y + 18} r="22" fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="58" cy={y + 58} r="22" fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="502" cy={y + 18} r="22" fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="502" cy={y + 58} r="22" fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <text x="280" y={y - 8} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                {izquierdo?.codigoDisco ?? derecho?.codigoDisco ? `Disco ${izquierdo?.codigoDisco ?? derecho?.codigoDisco}` : 'Disco sin código'}
              </text>

              <MitadDisco x={190} y={y} disco={izquierdo} lado="izquierdo" onSeleccionarDisco={onSeleccionarDisco} />
              <MitadDisco x={280} y={y} disco={derecho} lado="derecho" onSeleccionarDisco={onSeleccionarDisco} />

              <line x1="280" y1={y + 4} x2="280" y2={y + 72} stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              <text x="144" y={y + 42} textAnchor="end" className="fill-concreto-oscuro font-data text-[14px]">
                {formatoRd(izquierdo?.rd ?? null)}
              </text>
              <text x="416" y={y + 42} className="fill-concreto-oscuro font-data text-[14px]">
                {formatoRd(derecho?.rd ?? null)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

type MitadDiscoProps = {
  x: number
  y: number
  lado: 'izquierdo' | 'derecho'
  disco: FleetDiscoDetalle | null
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
}

function MitadDisco({ x, y, lado, disco, onSeleccionarDisco }: MitadDiscoProps) {
  const disponible = Boolean(disco?.codigoDisco && disco.estadoCalculado)
  const etiqueta = disco ? `${lado}: ${textoEstado(disco)} · ${formatoRd(disco.rd)}` : `${lado}: Sin datos`
  const rx = lado === 'izquierdo' ? 32 : 0
  const path =
    lado === 'izquierdo'
      ? `M ${x + 90} ${y + 4} H ${x + 34} A 34 34 0 0 0 ${x + 34} ${y + 72} H ${x + 90} Z`
      : `M ${x} ${y + 4} H ${x + 56} A 34 34 0 0 1 ${x + 56} ${y + 72} H ${x} Z`

  return (
    <g
      role={disponible ? 'button' : 'img'}
      tabIndex={disponible ? 0 : undefined}
      aria-label={etiqueta}
      onClick={() => {
        if (disponible && disco) onSeleccionarDisco(disco)
      }}
      onKeyDown={(e) => {
        if (!disponible || !disco) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSeleccionarDisco(disco)
        }
      }}
      className={disponible ? 'cursor-pointer outline-none' : 'cursor-default'}
    >
      <title>{etiqueta}</title>
      <path
        d={path}
        fill={colorEstado(disco?.estadoCalculado ?? null)}
        opacity={disco?.estadoCalculado ? 0.92 : 0.32}
        stroke="rgba(255,255,255,0.82)"
        strokeWidth="2"
        style={{ filter: 'drop-shadow(0 8px 8px rgba(15,23,42,0.12))' }}
      />
      <rect x={lado === 'izquierdo' ? x + 76 : x} y={y + 4} width="14" height="68" rx={rx} fill="rgba(255,255,255,0.12)" />
    </g>
  )
}
