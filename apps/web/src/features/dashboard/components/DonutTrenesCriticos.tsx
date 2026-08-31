import { AlertTriangle, Info } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'

const R = 88
const GROSOR = 30
const C = 2 * Math.PI * R
const CENTRO = R + GROSOR / 2 + 4

type Props = {
  critico: number
  cambio: number
  cargando: boolean
}

// Donut de 2 porciones (Crítico vs Cambio) — a diferencia de EVA-Aldy, EVA no
// tiene 3 niveles de severidad (Monitorear/Programar/Inmediato): estos 2 son
// los únicos estados de disco que ya requieren intervención pronta (ver
// BrakeDiscRulesEngine), así que son los únicos que tiene sentido mostrar acá
// como "trenes críticos". Técnica clásica de donut con 2 <circle> apiladas y
// strokeDasharray/strokeDashoffset, sin librería (mismo criterio que el resto
// de gráficos del proyecto). Círculo grande y centrado con leyenda debajo,
// proporción calcada del donut de EVA-Aldy (radio grande relativo al
// contenedor) — ver trenes-criticos-card.tsx en EVA-Aldy.
export function DonutTrenesCriticos({ critico, cambio, cargando }: Props) {
  const total = critico + cambio
  const largoCritico = total > 0 ? (critico / total) * C : 0
  const largoCambio = total > 0 ? (cambio / total) * C : 0

  return (
    <GlassSurface fuerte className="rounded-glass p-5">
      <div className="mb-0.5 flex items-center gap-1.5">
        <AlertTriangle size={16} className="text-concreto-oscuro" aria-hidden />
        <h3 className="font-display text-base font-semibold text-concreto-oscuro">Trenes críticos</h3>
        <WarningTooltip texto="Discos cuyo estado calculado ya requiere intervención: Crítico (Rd ≤ 0) o Cambio (0 < Rd ≤ 0.4).">
          <Info size={14} className="text-concreto" aria-label="Más información" />
        </WarningTooltip>
      </div>
      <p className="mb-4 font-body text-xs text-concreto">Discos que ya requieren intervención, fleet-wide</p>

      {cargando ? (
        <div className="flex h-40 items-center justify-center">
          <p className="font-body text-sm text-concreto">Cargando…</p>
        </div>
      ) : total === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="font-body text-sm text-concreto">Sin discos en Crítico o Cambio ahora.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <svg viewBox={`0 0 ${CENTRO * 2} ${CENTRO * 2}`} className="h-64 w-64 shrink-0" role="img" aria-label={`Trenes críticos: ${critico} discos en estado Crítico, ${cambio} en Cambio`}>
            <circle cx={CENTRO} cy={CENTRO} r={R} fill="none" stroke="rgba(140,137,127,0.15)" strokeWidth={GROSOR} />
            <circle
              cx={CENTRO}
              cy={CENTRO}
              r={R}
              fill="none"
              stroke="var(--color-estado-critico)"
              strokeWidth={GROSOR}
              strokeDasharray={`${largoCritico} ${C - largoCritico}`}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
            />
            <circle
              cx={CENTRO}
              cy={CENTRO}
              r={R}
              fill="none"
              stroke="var(--color-estado-cambio)"
              strokeWidth={GROSOR}
              strokeDasharray={`${largoCambio} ${C - largoCambio}`}
              strokeDashoffset={-largoCritico}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
            />
            <text x={CENTRO} y={CENTRO - 6} textAnchor="middle" fontSize={34} fontWeight={700} fill="var(--color-concreto-oscuro)" className="font-data">
              {total}
            </text>
            <text x={CENTRO} y={CENTRO + 20} textAnchor="middle" fontSize={12} fill="var(--color-gris-concreto)" className="font-body uppercase tracking-wide">
              discos
            </text>
          </svg>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2 font-body text-xs font-semibold text-concreto">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-estado-critico)' }} />
              <span>Crítico</span>
              <strong className="font-data text-sm text-concreto-oscuro">{critico}</strong>
            </span>
            <span className="flex items-center gap-2 font-body text-xs font-semibold text-concreto">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-estado-cambio)' }} />
              <span>Cambio</span>
              <strong className="font-data text-sm text-concreto-oscuro">{cambio}</strong>
            </span>
          </div>
        </div>
      )}
    </GlassSurface>
  )
}
