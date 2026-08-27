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

// Ansaldo: cada eje trae 4 discos (interior + exterior por lado) en vez de 2
// — cualquier disco con posicion distinta de 'unica' ya delata el eje.
function esEjeAnsaldo(discos: FleetDiscoDetalle[]): boolean {
  return discos.some((disco) => disco.posicion !== 'unica')
}

export function BogieVisualizer({ bogie, onSeleccionarDisco }: Props) {
  const ejes = bogie.ejes.slice(0, 2)

  return (
    <div className="rounded-glass border border-concreto/15 bg-white/35 p-3">
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
        </defs>

        {ejes.map((eje, idx) => {
          const y = 34 + idx * 104

          if (esEjeAnsaldo(eje.discos)) {
            const izqExt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'exterior') ?? null
            const izqInt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'interior') ?? null
            const derInt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'interior') ?? null
            const derExt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'exterior') ?? null
            const codigoRef = izqExt?.codigoDisco ?? izqInt?.codigoDisco ?? derInt?.codigoDisco ?? derExt?.codigoDisco

            return (
              <g key={eje.eje}>
                <line x1="78" y1={y + 38} x2="482" y2={y + 38} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
                <circle cx="58" cy={y + 38} r="22" fill="rgba(15,23,42,0.16)" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
                <circle cx="502" cy={y + 38} r="22" fill="rgba(15,23,42,0.16)" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
                <text x="280" y={y - 8} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                  {codigoRef ? `Disco ${codigoRef}` : 'Disco sin código'}
                </text>

                <CuartoDisco x={190} y={y} lado="izquierdo" posicion="exterior" disco={izqExt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={190} y={y} lado="izquierdo" posicion="interior" disco={izqInt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={280} y={y} lado="derecho" posicion="interior" disco={derInt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={280} y={y} lado="derecho" posicion="exterior" disco={derExt} onSeleccionarDisco={onSeleccionarDisco} />

                <line x1="280" y1={y + 4} x2="280" y2={y + 72} stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
                <text x="144" y={y + 24} textAnchor="end" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(izqExt?.rd ?? null)}
                </text>
                <text x="144" y={y + 58} textAnchor="end" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(izqInt?.rd ?? null)}
                </text>
                <text x="416" y={y + 24} className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(derInt?.rd ?? null)}
                </text>
                <text x="416" y={y + 58} className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(derExt?.rd ?? null)}
                </text>
              </g>
            )
          }

          const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo') ?? null
          const derecho = eje.discos.find((disco) => disco.lado === 'derecho') ?? null
          return (
            <g key={eje.eje}>
              <line x1="78" y1={y + 38} x2="482" y2={y + 38} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
              <circle cx="58" cy={y + 38} r="22" fill="rgba(15,23,42,0.16)" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
              <circle cx="502" cy={y + 38} r="22" fill="rgba(15,23,42,0.16)" stroke="rgba(15,23,42,0.22)" strokeWidth="2" />
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

type CuartoDiscoProps = {
  x: number
  y: number
  lado: 'izquierdo' | 'derecho'
  posicion: 'interior' | 'exterior'
  disco: FleetDiscoDetalle | null
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
}

// Ansaldo: mismo "medio disco" que MitadDisco, pero partido además en altura
// (exterior arriba, interior abajo) para representar los 2 discos por lado.
function CuartoDisco({ x, y, lado, posicion, disco, onSeleccionarDisco }: CuartoDiscoProps) {
  const disponible = Boolean(disco?.codigoDisco && disco.estadoCalculado)
  const etiqueta = disco
    ? `${lado} ${posicion}: ${textoEstado(disco)} · ${formatoRd(disco.rd)}`
    : `${lado} ${posicion}: Sin datos`
  const yTop = posicion === 'exterior' ? y + 4 : y + 38
  const yBottom = posicion === 'exterior' ? y + 38 : y + 72
  const path =
    lado === 'izquierdo'
      ? `M ${x + 90} ${yTop} H ${x + 34} A 34 17 0 0 0 ${x + 34} ${yBottom} H ${x + 90} Z`
      : `M ${x} ${yTop} H ${x + 56} A 34 17 0 0 1 ${x + 56} ${yBottom} H ${x} Z`

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
        strokeWidth="1.5"
        style={{ filter: 'drop-shadow(0 6px 6px rgba(15,23,42,0.1))' }}
      />
    </g>
  )
}
