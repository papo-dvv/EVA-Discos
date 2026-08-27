import { History, PenSquare, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { FABRICANTE_PILDORA, fabricanteDeTren } from '../../fleet/components/fabricante'
import type { SemaforoTrenMediciones } from '../types'
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
  onAbrirCarga: (modo: 'csv' | 'manual') => void
}

export function TrenSemaforoCard({ tren, onAbrirCarga }: Props) {
  const meta = SEMAFORO_MEDICIONES_META[tren.estadoSemaforo]
  const fabricante = fabricanteDeTren(tren.tren)
  const esAnsaldo = fabricante === 'ANSALDO'

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

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-body text-sm font-semibold" style={{ color: meta.cssVar }}>
            <meta.Icono className="h-4 w-4" aria-hidden />
            {meta.etiqueta}
          </span>
          <span className="font-data text-2xl font-bold leading-none text-concreto-oscuro">
            {tren.diasSinMedir ?? '—'}
            {tren.diasSinMedir !== null && <span className="ml-0.5 text-sm font-semibold text-concreto">d</span>}
          </span>
        </div>

        <p className="mt-2 font-body text-xs text-concreto">
          Última: <span className="font-data">{formatearFecha(tren.fechaUltimaMedicion)}</span>
        </p>

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
