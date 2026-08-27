import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import type { FleetBogieDetalle, FleetDiscoDetalle } from '../types'
import { colorEstado, ESTADO_META } from './estadoVisual'

type Props = {
  bogie: FleetBogieDetalle
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
  posicion?: number
  total?: number
}

// Geometría del disco: óvalo real (media elipse por lado), no la "pastilla"
// rect+arco de antes — un disco combinado mide RX*2 x RY*2 (≈84x100,
// aspecto ≈1.2:1), bastante más redondo que el 180x68 (≈2.65:1) original.
const RX = 42
const RY = 50
const RADIO_RUEDA = 30
const FILA_ALTO = 150
const FILA_Y_INICIAL = 40

// T de un disco nuevo (ver operations-cambio-disco.service.ts: el placeholder
// de "Cambio de disco" usa T=7.00, H=0.00) — única referencia de "100%" que
// existe hoy en el dominio, no hay un valor "de fábrica" guardado por disco.
const T_DISCO_NUEVO = 7

function formatoRd(rd: number | null): string {
  return rd === null ? 'Sin datos' : `Rd ${rd.toFixed(2)}`
}

function textoEstado(disco: FleetDiscoDetalle): string {
  if (!disco.estadoCalculado) return 'Sin datos'
  return ESTADO_META[disco.estadoCalculado].etiqueta
}

function formatoNumero(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(2)
}

function formatoFecha(fecha: string | null): string {
  return fecha ?? '—'
}

function formatoVidaUtil(t: number | null): string {
  if (t === null) return '—'
  const porcentaje = Math.max(0, Math.min(100, (t / T_DISCO_NUEVO) * 100))
  return `${porcentaje.toFixed(0)}%`
}

// Ansaldo: cada eje trae 4 discos (interior + exterior por lado) en vez de 2
// — cualquier disco con posicion distinta de 'unica' ya delata el eje.
function esEjeAnsaldo(discos: FleetDiscoDetalle[]): boolean {
  return discos.some((disco) => disco.posicion !== 'unica')
}

// Hover/foco sobre la mitad de un disco (dentro del <svg>) — posiciona un
// tooltip flotante vía portal a document.body, mismo criterio de posicionado
// que WarningTooltip.tsx pero disparado desde un <g> en vez de un <span> (no
// se puede envolver contenido SVG en ese componente compartido).
function useTooltipHover() {
  const ref = useRef<SVGGElement>(null)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })

  function mostrar() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setCoords({ left: rect.left + rect.width / 2, top: rect.top })
    setVisible(true)
  }
  function ocultar() {
    setVisible(false)
  }

  return { ref, visible, coords, mostrar, ocultar }
}

function FilaTooltip({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-concreto">{etiqueta}</dt>
      <dd className="font-data font-semibold text-concreto-oscuro">{valor}</dd>
    </div>
  )
}

function TooltipDiscoContenido({
  disco,
  lado,
  posicion,
  coords,
}: {
  disco: FleetDiscoDetalle
  lado: 'izquierdo' | 'derecho'
  posicion?: 'interior' | 'exterior'
  coords: { left: number; top: number }
}) {
  return createPortal(
    <GlassSurface
      fuerte
      role="tooltip"
      className="pointer-events-none z-[60] w-56 rounded-glass-sm px-3 py-2.5 font-body text-xs leading-snug"
      // position:fixed va en el style (no en className) a propósito: la clase
      // `.glass-surface` fija `position: relative` en tokens.css con la misma
      // especificidad que la utilidad `fixed` de Tailwind, y gana por orden de
      // cascada — el tooltip terminaba en flujo normal al final de <body> en
      // vez de flotar junto al disco. El inline style siempre gana.
      style={{ position: 'fixed', left: coords.left, top: coords.top - 10, transform: 'translate(-50%, -100%)' }}
    >
      <p className="mb-1.5 font-semibold uppercase tracking-wide text-concreto">
        {lado}
        {posicion ? ` · ${posicion}` : ''}
      </p>
      <dl className="space-y-0.5">
        <FilaTooltip etiqueta="T" valor={formatoNumero(disco.t)} />
        <FilaTooltip etiqueta="H" valor={formatoNumero(disco.h)} />
        <FilaTooltip etiqueta="Rd" valor={formatoNumero(disco.rd)} />
        <FilaTooltip etiqueta="Estado" valor={disco.estadoCalculado ? ESTADO_META[disco.estadoCalculado].etiqueta : 'Sin datos'} />
        <FilaTooltip etiqueta="Vida útil" valor={formatoVidaUtil(disco.t)} />
        <FilaTooltip etiqueta="Última medición" valor={formatoFecha(disco.fechaUltimaMedicion)} />
        <FilaTooltip etiqueta="Último cambio" valor={formatoFecha(disco.fechaUltimoCambio)} />
        <FilaTooltip etiqueta="Último reperfilado" valor={formatoFecha(disco.fechaUltimoReperfilado)} />
      </dl>
    </GlassSurface>,
    document.body,
  )
}

export function BogieVisualizer({ bogie, onSeleccionarDisco, posicion, total }: Props) {
  const ejes = bogie.ejes.slice(0, 2)
  const altoSvg = FILA_Y_INICIAL + ejes.length * FILA_ALTO

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 shadow-[inset_0_1px_0_white]">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="font-display text-sm font-semibold text-concreto-oscuro">
          {bogie.bogie}
          {posicion && total ? (
            <span className="ml-2 font-body text-xs font-normal text-concreto">
              {' '}
              · Bogie {posicion} de {total}
            </span>
          ) : null}
        </h3>
      </div>

      <svg
        viewBox={`0 0 560 ${altoSvg}`}
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
          const y = FILA_Y_INICIAL + idx * FILA_ALTO
          const discoCentroY = y + 4 + RY
          const discoAbajoY = y + 4 + RY * 2

          if (esEjeAnsaldo(eje.discos)) {
            const izqExt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'exterior') ?? null
            const izqInt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'interior') ?? null
            const derInt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'interior') ?? null
            const derExt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'exterior') ?? null
            const codigoRef = izqExt?.codigoDisco ?? izqInt?.codigoDisco ?? derInt?.codigoDisco ?? derExt?.codigoDisco

            return (
              <g key={eje.eje}>
                <line x1="78" y1={discoCentroY} x2="482" y2={discoCentroY} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
                <circle cx="58" cy={discoCentroY} r={RADIO_RUEDA} fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="502" cy={discoCentroY} r={RADIO_RUEDA} fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
                <text x="280" y={y - 6} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                  Eje {eje.eje}: {codigoRef ? `Disco ${codigoRef}` : 'Disco sin código'}
                </text>

                <CuartoDisco x={190} y={y} lado="izquierdo" posicion="exterior" disco={izqExt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={190} y={y} lado="izquierdo" posicion="interior" disco={izqInt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={280} y={y} lado="derecho" posicion="interior" disco={derInt} onSeleccionarDisco={onSeleccionarDisco} />
                <CuartoDisco x={280} y={y} lado="derecho" posicion="exterior" disco={derExt} onSeleccionarDisco={onSeleccionarDisco} />

                <line x1="280" y1={y + 4} x2="280" y2={discoAbajoY} stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
                <text x={280 - RX - 40} y={y + 4 + RY / 2} textAnchor="end" dominantBaseline="middle" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(izqExt?.rd ?? null)}
                </text>
                <text x={280 - RX - 40} y={y + 4 + RY * 1.5} textAnchor="end" dominantBaseline="middle" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(izqInt?.rd ?? null)}
                </text>
                <text x={280 + RX + 40} y={y + 4 + RY / 2} dominantBaseline="middle" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(derInt?.rd ?? null)}
                </text>
                <text x={280 + RX + 40} y={y + 4 + RY * 1.5} dominantBaseline="middle" className="fill-concreto-oscuro font-data text-[11px]">
                  {formatoRd(derExt?.rd ?? null)}
                </text>
              </g>
            )
          }

          const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo') ?? null
          const derecho = eje.discos.find((disco) => disco.lado === 'derecho') ?? null
          return (
            <g key={eje.eje}>
              <line x1="78" y1={discoCentroY} x2="482" y2={discoCentroY} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
              <circle cx="58" cy={discoCentroY} r={RADIO_RUEDA} fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="502" cy={discoCentroY} r={RADIO_RUEDA} fill={`url(#metal-${bogie.bogie})`} stroke="#cbd5e1" strokeWidth="2" />
              <text x="280" y={y - 6} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                Eje {eje.eje}: {izquierdo?.codigoDisco ?? derecho?.codigoDisco ? `Disco ${izquierdo?.codigoDisco ?? derecho?.codigoDisco}` : 'Disco sin código'}
              </text>

              <MitadDisco x={190} y={y} disco={izquierdo} lado="izquierdo" onSeleccionarDisco={onSeleccionarDisco} />
              <MitadDisco x={280} y={y} disco={derecho} lado="derecho" onSeleccionarDisco={onSeleccionarDisco} />

              <line x1="280" y1={y + 4} x2="280" y2={discoAbajoY} stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
              <text x={280 - RX - 30} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[14px]">
                {formatoRd(izquierdo?.rd ?? null)}
              </text>
              <text x={280 + RX + 30} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[14px]">
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
  const cx = lado === 'izquierdo' ? x + 90 : x
  const arriba = y + 4
  const abajo = y + 4 + RY * 2
  const sweep = lado === 'izquierdo' ? 0 : 1
  const path = `M ${cx} ${arriba} A ${RX} ${RY} 0 0 ${sweep} ${cx} ${abajo} Z`
  const tooltip = useTooltipHover()

  return (
    <>
      <g
        ref={tooltip.ref}
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
        onMouseEnter={tooltip.mostrar}
        onMouseLeave={tooltip.ocultar}
        onFocus={tooltip.mostrar}
        onBlur={tooltip.ocultar}
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
      </g>
      {tooltip.visible && disco && <TooltipDiscoContenido disco={disco} lado={lado} coords={tooltip.coords} />}
    </>
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
// (exterior arriba, interior abajo) para representar los 2 discos por lado —
// cada cuarto es una media elipse de la mitad de alto (RY/2).
function CuartoDisco({ x, y, lado, posicion, disco, onSeleccionarDisco }: CuartoDiscoProps) {
  const disponible = Boolean(disco?.codigoDisco && disco.estadoCalculado)
  const etiqueta = disco
    ? `${lado} ${posicion}: ${textoEstado(disco)} · ${formatoRd(disco.rd)}`
    : `${lado} ${posicion}: Sin datos`
  const cx = lado === 'izquierdo' ? x + 90 : x
  const yTop = posicion === 'exterior' ? y + 4 : y + 4 + RY
  const yBottom = posicion === 'exterior' ? y + 4 + RY : y + 4 + RY * 2
  const sweep = lado === 'izquierdo' ? 0 : 1
  const path = `M ${cx} ${yTop} A ${RX} ${RY / 2} 0 0 ${sweep} ${cx} ${yBottom} Z`
  const tooltip = useTooltipHover()

  return (
    <>
      <g
        ref={tooltip.ref}
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
        onMouseEnter={tooltip.mostrar}
        onMouseLeave={tooltip.ocultar}
        onFocus={tooltip.mostrar}
        onBlur={tooltip.ocultar}
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
      {tooltip.visible && disco && (
        <TooltipDiscoContenido disco={disco} lado={lado} posicion={posicion} coords={tooltip.coords} />
      )}
    </>
  )
}
