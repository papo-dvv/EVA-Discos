import { History, Lock, PenSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { FABRICANTE_PILDORA, fabricanteDeTren } from '../../fleet/components/fabricante'
import type { SemaforoTrenMediciones } from '../types'
import { SEMAFORO_MEDICIONES_META } from './semaforoMedicionesVisual'

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
export function TrenSemaforoCard({ tren }: { tren: SemaforoTrenMediciones }) {
  const meta = SEMAFORO_MEDICIONES_META[tren.estadoSemaforo]
  const fabricante = fabricanteDeTren(tren.tren)

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
            <button
              type="button"
              disabled
              title="CSV por tren — próximamente"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-concreto/25 px-3 py-1.5 font-body text-xs font-medium text-concreto/50"
            >
              <Lock size={13} aria-hidden />
              CSV
            </button>
          </div>
          <Link
            to="/nuevas-mediciones"
            className="flex items-center gap-1.5 rounded-full bg-concreto-oscuro px-3 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-black"
          >
            <PenSquare size={14} aria-hidden />
            Manual
          </Link>
        </div>
      </div>
    </GlassSurface>
  )
}
