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
// rect+arco de antes — un disco combinado mide RX*2 x RY*2 (≈116x136,
// aspecto ≈1.17:1). Agrandado (antes 42x50) al quitar las ruedas de los
// extremos del eje: sin ellas compitiendo por espacio, el disco (lo único
// que de verdad importa acá) puede ser más grande y legible.
const RX = 58
const RY = 68
// Antes "4": el disco arrancaba pegado al título del eje, sin lugar para
// nada más arriba. Con H y el lado (Izquierda/Derecha) agregados encima del
// disco, hace falta este colchón — DISCO_TOP es la distancia desde el
// arranque de la fila (`y`) hasta el borde superior del disco.
const DISCO_TOP = 52
// +90 sobre el valor anterior (150): con DISCO_TOP más grande y las 2 líneas
// de texto nuevas arriba del disco, las filas quedaban demasiado pegadas
// (disco 1 vs disco 2 del mismo bogie) y el Rd de abajo invadía la fila
// siguiente — ver comentario de discoAbajoY.
const FILA_ALTO = 240
const FILA_Y_INICIAL = 40

// Distancia desde el centro del eje (x=280) a cada grupo de disco Ansaldo.
// Con RX/RY igualados a Alstom, cada grupo dibuja 4 lecturas de Rd (exterior
// + interior por lado) en vez de las 2 de Alstom — sin este respiro extra el
// texto "interior" de un grupo choca con el "exterior" del grupo vecino (ver
// DiscoAnsaldoDoble).
const ANSALDO_GAP = 130
// Desplazamiento lateral de las etiquetas H/Rd de cada mitad Ansaldo respecto
// al centro de su óvalo — un poco menor que el de Alstom (RX+30) porque acá
// hay 4 columnas de texto en vez de 2 compitiendo por el mismo ancho de fila.
const ANSALDO_TEXTO_OFFSET = RX + 26

// T de un disco nuevo (ver operations-cambio-disco.service.ts: el placeholder
// de "Cambio de disco" usa T=7.00, H=0.00) — única referencia de "100%" que
// existe hoy en el dominio, no hay un valor "de fábrica" guardado por disco.
const T_DISCO_NUEVO = 7

function formatoRd(rd: number | null): string {
  return rd === null ? 'Sin datos' : `Rd ${rd.toFixed(2)}`
}

// En el esquema compacto de Ansaldo (4 lecturas de Rd por eje en vez de 2) el
// texto largo "Sin datos" se superpone entre los 2 grupos; el detalle
// completo permanece disponible al pasar el cursor.
function formatoRdEsquema(rd: number | null): string {
  return rd === null ? '—' : `Rd ${rd.toFixed(2)}`
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
  const [discoActivo, setDiscoActivo] = useState<FleetDiscoDetalle | null>(null)
  const seleccionar = (disco: FleetDiscoDetalle) => {
    setDiscoActivo(disco)
    onSeleccionarDisco(disco)
  }
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
        </defs>

        {ejes.map((eje, idx) => {
          const y = FILA_Y_INICIAL + idx * FILA_ALTO
          const discoCentroY = y + DISCO_TOP + RY
          const discoAbajoY = y + DISCO_TOP + RY * 2

          if (esEjeAnsaldo(eje.discos)) {
            const izqExt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'exterior') ?? null
            const izqInt = eje.discos.find((d) => d.lado === 'izquierdo' && d.posicion === 'interior') ?? null
            const derInt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'interior') ?? null
            const derExt = eje.discos.find((d) => d.lado === 'derecho' && d.posicion === 'exterior') ?? null
            const codigoRef = izqExt?.codigoDisco ?? izqInt?.codigoDisco ?? derInt?.codigoDisco ?? derExt?.codigoDisco

            const izqX = 280 - ANSALDO_GAP
            const derX = 280 + ANSALDO_GAP

            return (
              <g key={eje.eje}>
                {/* En Ansaldo se representa únicamente el conjunto de discos:
                    sin ruedas laterales y con el eje limpio como en la ficha. */}
                <line x1="8" y1={discoCentroY} x2="552" y2={discoCentroY} stroke="#cbd5e1" strokeWidth="8" />
                <text x="280" y={y - 6} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                  Eje {eje.eje}: {codigoRef ? `Disco ${codigoRef}` : 'Disco sin código'}
                </text>

                {/* 4 lados físicos por eje (no 2, como Alstom): de afuera
                    hacia adentro, Izq. externo → Izq. interno → Der. interno
                    → Der. externo. En 2 niveles (lado arriba de todo el
                    óvalo, externo/interno más chico por mitad) en vez de un
                    solo texto largo por mitad — "Izq. externo"/"Izq. interno"
                    no entran uno al lado del otro en el ancho de una sola
                    mitad (58px) sin pisarse. Mismo criterio de Alstom (lado
                    arriba, H debajo, Rd debajo del disco) con 2 columnas más
                    — ver DiscoAnsaldoDoble para el mapeo exterior=mitad más
                    externa / interior=mitad más interna dentro de cada óvalo. */}
                <text x={izqX} y={y + 17} textAnchor="middle" className="fill-concreto font-body text-[10px] font-semibold uppercase tracking-wide">
                  Izquierdo
                </text>
                <text x={derX} y={y + 17} textAnchor="middle" className="fill-concreto font-body text-[10px] font-semibold uppercase tracking-wide">
                  Derecho
                </text>
                <text x={izqX - RX / 2} y={y + 29} textAnchor="middle" className="fill-concreto/80 font-body text-[8px] font-semibold uppercase tracking-wide">
                  Externo
                </text>
                <text x={izqX + RX / 2} y={y + 29} textAnchor="middle" className="fill-concreto/80 font-body text-[8px] font-semibold uppercase tracking-wide">
                  Interno
                </text>
                <text x={derX - RX / 2} y={y + 29} textAnchor="middle" className="fill-concreto/80 font-body text-[8px] font-semibold uppercase tracking-wide">
                  Interno
                </text>
                <text x={derX + RX / 2} y={y + 29} textAnchor="middle" className="fill-concreto/80 font-body text-[8px] font-semibold uppercase tracking-wide">
                  Externo
                </text>

                <text x={izqX - ANSALDO_TEXTO_OFFSET} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  H {formatoNumero(izqExt?.h ?? null)}
                </text>
                <text x={izqX + ANSALDO_TEXTO_OFFSET} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  H {formatoNumero(izqInt?.h ?? null)}
                </text>
                <text x={derX - ANSALDO_TEXTO_OFFSET} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  H {formatoNumero(derInt?.h ?? null)}
                </text>
                <text x={derX + ANSALDO_TEXTO_OFFSET} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  H {formatoNumero(derExt?.h ?? null)}
                </text>

                <DiscoAnsaldoDoble x={izqX} y={discoCentroY} lado="izquierdo" exterior={izqExt} interior={izqInt} activo={discoActivo} onSeleccionarDisco={seleccionar} />
                <DiscoAnsaldoDoble x={derX} y={discoCentroY} lado="derecho" exterior={derExt} interior={derInt} activo={discoActivo} onSeleccionarDisco={seleccionar} />

                <text x={izqX - ANSALDO_TEXTO_OFFSET} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  {formatoRdEsquema(izqExt?.rd ?? null)}
                </text>
                <text x={izqX + ANSALDO_TEXTO_OFFSET} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  {formatoRdEsquema(izqInt?.rd ?? null)}
                </text>
                <text x={derX - ANSALDO_TEXTO_OFFSET} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  {formatoRdEsquema(derInt?.rd ?? null)}
                </text>
                <text x={derX + ANSALDO_TEXTO_OFFSET} y={discoAbajoY + 18} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                  {formatoRdEsquema(derExt?.rd ?? null)}
                </text>
              </g>
            )
          }

          const izquierdo = eje.discos.find((disco) => disco.lado === 'izquierdo') ?? null
          const derecho = eje.discos.find((disco) => disco.lado === 'derecho') ?? null
          return (
            <g key={eje.eje}>
              <line x1="78" y1={discoCentroY} x2="482" y2={discoCentroY} stroke="rgba(31,41,55,0.18)" strokeWidth="8" strokeLinecap="round" />
              <line x1="92" y1={discoCentroY} x2="468" y2={discoCentroY} stroke="#64748b" strokeWidth="12" strokeLinecap="round" opacity="0.75" />
              <circle cx="280" cy={discoCentroY} r="25" fill="#cbd5e1" stroke="#475569" strokeWidth="3" />
              <circle cx="280" cy={discoCentroY} r="13" fill="#334155" stroke="#e2e8f0" strokeWidth="3" />
              <text x="280" y={y + 8} textAnchor="middle" className="fill-concreto font-body text-[12px] font-semibold">
                Eje {eje.eje}: {izquierdo?.codigoDisco ?? derecho?.codigoDisco ? `Disco ${izquierdo?.codigoDisco ?? derecho?.codigoDisco}` : 'Disco sin código'}
              </text>
              {/* Lado, primero (justo debajo del título del eje). */}
              <text x={280 - RX / 2} y={y + 27} textAnchor="middle" className="fill-concreto font-body text-[10px] font-semibold uppercase tracking-wide">
                Izquierda
              </text>
              <text x={280 + RX / 2} y={y + 27} textAnchor="middle" className="fill-concreto font-body text-[10px] font-semibold uppercase tracking-wide">
                Derecha
              </text>
              {/* H después, pegado al disco — misma distancia lateral (RX+30)
                  que el Rd de abajo, para que ambos queden alineados en
                  columna aunque estén en lados opuestos. */}
              <text x={280 - RX - 30} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                H {formatoNumero(izquierdo?.h ?? null)}
              </text>
              <text x={280 + RX + 30} y={y + 44} textAnchor="middle" className="fill-concreto-oscuro font-data text-[12px]">
                H {formatoNumero(derecho?.h ?? null)}
              </text>

              <MitadDisco x={190} y={y} disco={izquierdo} lado="izquierdo" activo={discoActivo === izquierdo} onSeleccionarDisco={seleccionar} />
              <MitadDisco x={280} y={y} disco={derecho} lado="derecho" activo={discoActivo === derecho} onSeleccionarDisco={seleccionar} />
              <circle cx="280" cy={discoCentroY} r="16" fill="#475569" stroke="#f8fafc" strokeWidth="3" pointerEvents="none" />
              <circle cx="280" cy={discoCentroY} r="7" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" pointerEvents="none" />

              <line x1="280" y1={y + DISCO_TOP} x2="280" y2={discoAbajoY} stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
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
  activo: boolean
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
}

function MitadDisco({ x, y, lado, disco, activo, onSeleccionarDisco }: MitadDiscoProps) {
  // codigoDisco puede faltar por un catálogo de bogies incompleto (ver
  // ResolverCodigoDiscoService) aunque el disco SÍ tenga una medición real —
  // eso ya no debe bloquear el click: ModalHistoricoDisco sabe mostrar el
  // estado actual sin código (ver EstadoActualSinCodigo), solo se queda sin
  // histórico ni gemelo digital.
  const disponible = Boolean(disco?.estadoCalculado)
  const color = disco?.estadoCalculado ? colorEstado(disco.estadoCalculado) : '#cbd5e1'
  const etiqueta = disco ? `${lado}: ${textoEstado(disco)} · ${formatoRd(disco.rd)}` : `${lado}: Sin datos`
  const cx = lado === 'izquierdo' ? x + 90 : x
  const arriba = y + DISCO_TOP
  const abajo = y + DISCO_TOP + RY * 2
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
          className={activo ? 'eva-disco-seleccionado' : undefined}
          d={path}
          fill={color}
          opacity={1}
          stroke="rgba(255,255,255,0.82)"
          strokeWidth="2"
        style={{ filter: activo ? 'drop-shadow(0 0 12px rgba(16,185,129,0.9))' : 'drop-shadow(0 8px 8px rgba(15,23,42,0.12))' }}
        />
      </g>
      {tooltip.visible && disco && <TooltipDiscoContenido disco={disco} lado={lado} coords={tooltip.coords} />}
    </>
  )
}

type DiscoAnsaldoDobleProps = {
  x: number
  y: number
  lado: 'izquierdo' | 'derecho'
  exterior: FleetDiscoDetalle | null
  interior: FleetDiscoDetalle | null
  activo: FleetDiscoDetalle | null
  onSeleccionarDisco: (disco: FleetDiscoDetalle) => void
}

// Ansaldo: un óvalo completo por lado (misma RX/RY que el disco combinado de
// Alstom, ver MitadDisco), partido en mitades verticales exterior/interior —
// a diferencia de Alstom (2 mitades = 1 disco), acá cada mitad ES un disco
// propio (2 discos por lado). x llega ya separado del centro del eje por
// ANSALDO_GAP (ver el mapeo de ejes más arriba) para que el texto de un
// grupo no choque con el del grupo vecino.
//
// El sweep de cada mitad depende del lado para que "exterior" quede SIEMPRE
// del lado físicamente más externo del eje: en el óvalo izquierdo, exterior
// va a la izquierda (más lejos del centro) e interior a la derecha; en el
// óvalo derecho es al revés (interior a la izquierda, exterior a la
// derecha) — así el orden real de izquierda a derecha en el eje completo es
// Izq. externo → Izq. interno → Der. interno → Der. externo.
function DiscoAnsaldoDoble({ x, y, lado, exterior, interior, activo, onSeleccionarDisco }: DiscoAnsaldoDobleProps) {
  const disponibleExterior = Boolean(exterior?.estadoCalculado)
  const disponibleInterior = Boolean(interior?.estadoCalculado)
  const colorExterior = exterior?.estadoCalculado ? colorEstado(exterior.estadoCalculado) : '#dbeafe'
  const colorInterior = interior?.estadoCalculado ? colorEstado(interior.estadoCalculado) : '#c4b5fd'
  const tooltipExterior = useTooltipHover()
  const tooltipInterior = useTooltipHover()
  const arriba = y - RY
  const abajo = y + RY
  const sweepExterior = lado === 'izquierdo' ? 0 : 1
  const sweepInterior = lado === 'izquierdo' ? 1 : 0
  const pathExterior = `M ${x} ${arriba} A ${RX} ${RY} 0 0 ${sweepExterior} ${x} ${abajo} Z`
  const pathInterior = `M ${x} ${arriba} A ${RX} ${RY} 0 0 ${sweepInterior} ${x} ${abajo} Z`

  return (
    <>
      <g
        ref={tooltipExterior.ref}
        role={disponibleExterior ? 'button' : 'img'}
        tabIndex={disponibleExterior ? 0 : undefined}
        aria-label={exterior ? `${lado} exterior: ${textoEstado(exterior)} · ${formatoRd(exterior.rd)}` : `${lado} exterior: Sin datos`}
        onClick={() => {
          if (disponibleExterior && exterior) onSeleccionarDisco(exterior)
        }}
        onKeyDown={(e) => {
          if (!disponibleExterior || !exterior) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSeleccionarDisco(exterior)
          }
        }}
        onMouseEnter={tooltipExterior.mostrar}
        onMouseLeave={tooltipExterior.ocultar}
        onFocus={tooltipExterior.mostrar}
        onBlur={tooltipExterior.ocultar}
        className={disponibleExterior ? 'cursor-pointer outline-none' : 'cursor-default'}
      >
        <path className={activo === exterior ? 'eva-disco-seleccionado' : undefined} d={pathExterior} fill={colorExterior} stroke="#ffffff" strokeWidth="2" style={{ filter: 'drop-shadow(0 7px 7px rgba(15,23,42,0.12))' }} />
      </g>
      <g
        ref={tooltipInterior.ref}
        role={disponibleInterior ? 'button' : 'img'}
        tabIndex={disponibleInterior ? 0 : undefined}
        aria-label={interior ? `${lado} interior: ${textoEstado(interior)} · ${formatoRd(interior.rd)}` : `${lado} interior: Sin datos`}
        onClick={() => { if (disponibleInterior && interior) onSeleccionarDisco(interior) }}
        onKeyDown={(e) => { if (disponibleInterior && interior && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSeleccionarDisco(interior) } }}
        onMouseEnter={tooltipInterior.mostrar}
        onMouseLeave={tooltipInterior.ocultar}
        onFocus={tooltipInterior.mostrar}
        onBlur={tooltipInterior.ocultar}
        className={disponibleInterior ? 'cursor-pointer outline-none' : 'cursor-default'}
      >
        <path className={activo === interior ? 'eva-disco-seleccionado' : undefined} d={pathInterior} fill={colorInterior} stroke="#ffffff" strokeWidth="2" style={{ filter: 'drop-shadow(0 7px 7px rgba(15,23,42,0.12))' }} />
      </g>
      <ellipse cx={x} cy={y} rx={RX} ry={RY} fill="none" stroke="#64748b" strokeWidth="2.5" pointerEvents="none" />
      <circle cx={x} cy={y} r="16" fill="#475569" stroke="#f8fafc" strokeWidth="3" pointerEvents="none" />
      <circle cx={x} cy={y} r="7" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" pointerEvents="none" />
      {tooltipExterior.visible && exterior && <TooltipDiscoContenido disco={exterior} lado={lado} posicion="exterior" coords={tooltipExterior.coords} />}
      {tooltipInterior.visible && interior && <TooltipDiscoContenido disco={interior} lado={lado} posicion="interior" coords={tooltipInterior.coords} />}
    </>
  )
}
