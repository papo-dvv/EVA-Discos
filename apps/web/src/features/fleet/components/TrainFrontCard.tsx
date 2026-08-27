import type { CSSProperties } from 'react'
import { Train } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import type { FleetSummaryItem } from '../types'
import { ESTADO_META } from './estadoVisual'
import { FABRICANTE_CLASES, fabricanteDeTren } from './fabricante'
import { getEstadoDominanteTren, ICONO_ESTADO_TREN } from './semaforoTren'

function formatearKm(km: number | null): string {
  if (km === null) return 'Sin datos'
  return `${new Intl.NumberFormat('es-PE').format(Math.round(km))} km`
}

// Tarjeta principal de tren en el grid de Flota — calcada de EVA-Aldy
// (TrainFrontCard, ver styles-eva/flota-styles.md): borde + punto glow con
// el color de semáforo, ilustración animada a tamaño real (h-[280px], igual
// que Aldy) con glow + tinte enmascarado a la silueta, header con badge de
// fabricante y estado dominante del tren, kilometraje total centrado.
// Adaptada a los datos reales de EVA: no hay flag de material de giro en el
// summary (no existe en este dominio), así que ese badge no aplica; y el
// semáforo usa los 5 estados propios de EVA (OK/Seguimiento/Cambio/
// Crítico/Reperfilado, ver ESTADO_META) en vez del semáforo de 3 niveles de Aldy.
export function TrainFrontCard({ tren }: { tren: FleetSummaryItem }) {
  const estadoDominante = getEstadoDominanteTren(tren.conteoEstado)
  const { etiqueta, cssVar } = ESTADO_META[estadoDominante]
  const Icono = ICONO_ESTADO_TREN[estadoDominante]
  const fabricante = fabricanteDeTren(tren.tren)
  const trainIconSrc = fabricante === 'ALSTOM' ? '/images/alstomicon.png' : '/images/ansaldoicon.png'

  return (
    <GlassSurface
      fuerte
      className="overflow-hidden rounded-glass p-0 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl"
      style={{ borderColor: cssVar, borderWidth: 2 }}
    >
      {/* Ilustración del tren */}
      <div className="relative bg-gradient-to-b from-arena-suave/70 to-transparent px-4 pb-2 pt-4">
        <div
          className="absolute right-4 top-4 h-3 w-3 rounded-full shadow-[0_0_14px_currentColor]"
          style={{ backgroundColor: cssVar, color: cssVar }}
          aria-hidden
        />
        <div className="relative mx-auto h-[280px] w-full">
          <img
            src={trainIconSrc}
            alt=""
            className="animate-eva-flota-glow h-full w-full object-contain drop-shadow-xl"
            style={{ '--eva-flota-glow': `color-mix(in srgb, ${cssVar} 60%, transparent)` } as CSSProperties}
            aria-hidden
          />
          <div
            className="animate-eva-flota-tint absolute inset-0 mix-blend-multiply"
            style={{
              backgroundColor: cssVar,
              WebkitMaskImage: `url(${trainIconSrc})`,
              maskImage: `url(${trainIconSrc})`,
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* Info */}
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 border-b border-arena pb-3">
          <div className="rounded-md p-2" style={{ backgroundColor: 'var(--color-arena-suave)', color: cssVar }}>
            <Train className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-concreto-oscuro">Tren {tren.tren}</h3>
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${FABRICANTE_CLASES[fabricante]}`}>
                {fabricante === 'ALSTOM' ? 'Alstom' : 'Ansaldo'}
              </span>
            </div>
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `color-mix(in srgb, ${cssVar} 16%, transparent)`, color: cssVar }}
            >
              <Icono className="h-3 w-3" aria-hidden />
              {etiqueta}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="font-body text-[10px] font-bold uppercase tracking-wide text-concreto">Kilometraje total</p>
          <p className="mt-1 font-display text-2xl font-bold text-concreto-oscuro">{formatearKm(tren.kilometrajeActual)}</p>
        </div>
      </div>
    </GlassSurface>
  )
}
