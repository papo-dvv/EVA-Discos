import { History, PenSquare, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { FABRICANTE_PILDORA, fabricanteDeTren } from '../../fleet/components/fabricante'
import type { SemaforoTrenMediciones, UmbralesSemaforoMediciones } from '../types'
import { SEMAFORO_MEDICIONES_META } from './semaforoMedicionesVisual'

// Fichas de medición aún no habilitadas para la flota Ansaldo (sin catálogo
// de discos sembrado — ver fabricanteDeTren/CargaInicialFicha) — mientras eso
// no exista, los botones CSV y Manual quedan deshabilitados para esos trenes.
const TOOLTIP_ANSALDO_DESHABILITADO = 'Fichas de medición aún no habilitadas para trenes Ansaldo.'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

// Tarjeta de tren de la vista "Tarjetas" de Mediciones — calcada de
// EVA-Aldy (TrenSemaforoCard, ver styles-eva del módulo mediciones) pero
// con la tabla propia de EVA en "Historial" en vez del gráfico de Aldy, y
// sin el 5to nivel "Bloqueado" (no pedido). Franja superior de color +
// badge de fabricante en píldora sólida + número de días neutro, mismo
// lenguaje visual que la referencia.
type Props = {
  tren: SemaforoTrenMediciones
  umbrales: UmbralesSemaforoMediciones
  onAbrirCarga: (modo: 'csv' | 'manual') => void
}

function progresoDias(dias: number | null, umbrales: UmbralesSemaforoMediciones): number {
  if (dias === null) return 100
  return Math.min(100, Math.max(0, (dias / umbrales.prioridad) * 100))
}

export function TrenSemaforoCard({ tren, umbrales, onAbrirCarga }: Props) {
  const meta = SEMAFORO_MEDICIONES_META[tren.estadoSemaforo]
  const fabricante = fabricanteDeTren(tren.tren)
  const esAnsaldo = fabricante === 'ANSALDO'
  const progreso = progresoDias(tren.diasSinMedir, umbrales)
  const diasTexto = tren.diasSinMedir === null ? 'Sin registro' : `${tren.diasSinMedir} días`

  return (
    <GlassSurface
      fuerte
      className="overflow-hidden rounded-2xl p-0"
      style={{ borderRadius: 18 }}
    >
      {/* Franja superior de color de semáforo */}
      <div className="h-[5px] w-full" style={{ backgroundColor: meta.cssVar }} aria-hidden />

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-data text-xl font-bold text-concreto-oscuro">T{tren.tren}</h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${FABRICANTE_PILDORA[fabricante]}`}>
            {fabricante === 'ALSTOM' ? 'Alstom' : 'Ansaldo'}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-body text-sm font-semibold" style={{ color: meta.cssVar }}>
            <meta.Icono className="h-4 w-4" aria-hidden />
            {meta.etiqueta}
          </span>
          <span className="rounded-full px-2.5 py-1 font-data text-xs font-bold" style={{ backgroundColor: `color-mix(in srgb, ${meta.cssVar} 14%, white)`, color: meta.cssVar }}>
            {diasTexto}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/65 px-3 py-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.12em] text-concreto">Desde la última medición</p>
              <p className="mt-0.5 font-body text-xs text-concreto">{tren.fechaUltimaMedicion ? formatearFecha(tren.fechaUltimaMedicion) : 'No hay una medición registrada'}</p>
            </div>
            <span className="font-data text-xl font-bold leading-none text-concreto-oscuro">{tren.diasSinMedir ?? '—'}<span className="ml-0.5 text-xs text-concreto">{tren.diasSinMedir === null ? '' : 'd'}</span></span>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-label={`${diasTexto} desde la última medición`}>
            <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${progreso}%`, backgroundColor: meta.cssVar }} />
            {[umbrales.alerta, umbrales.critico, umbrales.prioridad].map((umbral) => (
              <span key={umbral} className="absolute top-1/2 z-10 h-3 w-px -translate-y-1/2 bg-white/90" style={{ left: `${Math.min(100, (umbral / umbrales.prioridad) * 100)}%` }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-data text-[9px] text-concreto">
            <span>0d</span><span>{umbrales.alerta}d</span><span>{umbrales.critico}d</span><span>{umbrales.prioridad}d+</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-arena pt-3">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/mediciones/historico?tren=${tren.tren}`}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-medium text-concreto transition-colors hover:bg-arena-suave hover:text-concreto-oscuro"
            >
              <History size={14} aria-hidden />
              Historial
            </Link>
            <BotonModoCarga
              esAnsaldo={esAnsaldo}
              onClick={() => onAbrirCarga('csv')}
              className={`flex items-center gap-1.5 rounded-full border border-concreto/25 px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                esAnsaldo ? 'cursor-not-allowed text-concreto/40' : 'text-concreto hover:bg-arena-suave hover:text-concreto-oscuro'
              }`}
            >
              <Upload size={13} aria-hidden />
              CSV
            </BotonModoCarga>
          </div>
          <BotonModoCarga
            esAnsaldo={esAnsaldo}
            onClick={() => onAbrirCarga('manual')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
              esAnsaldo ? 'cursor-not-allowed bg-concreto-oscuro/40 text-white/70' : 'bg-concreto-oscuro text-white hover:bg-black'
            }`}
          >
            <PenSquare size={14} aria-hidden />
            Manual
          </BotonModoCarga>
        </div>
      </div>
    </GlassSurface>
  )
}

// Botón CSV/Manual de la card — deshabilitado (con tooltip explicativo) para
// trenes Ansaldo. aria-disabled, NUNCA el atributo `disabled`: mismo criterio
// que SegmentedControl (un botón nativo disabled no dispara mouseenter/focus,
// y el WarningTooltip que lo envuelve jamás llegaría a mostrarse).
function BotonModoCarga({
  esAnsaldo,
  onClick,
  className,
  children,
}: {
  esAnsaldo: boolean
  onClick: () => void
  className: string
  children: ReactNode
}) {
  const boton = (
    <button
      type="button"
      aria-disabled={esAnsaldo || undefined}
      onClick={() => {
        if (!esAnsaldo) onClick()
      }}
      className={className}
    >
      {children}
    </button>
  )
  return esAnsaldo ? (
    <WarningTooltip texto={TOOLTIP_ANSALDO_DESHABILITADO}>{boton}</WarningTooltip>
  ) : (
    boton
  )
}
