import { GlassSurface } from '../../../components/GlassSurface'
import { useSystemParams } from '../../system-params/queries'
import type { EstadoDisco } from '../../scan-records/types'
import { ESTADO_META } from './estadoVisual'

// Mismas claves/valores por defecto que apps/api/src/brake-disc-rules/umbrales.ts
// (CLAVES_UMBRALES/UMBRALES_POR_DEFECTO) y que el grupo "Mediciones" de
// PanelParametros.tsx — no se importa desde el backend (frontend/backend son
// paquetes separados), así que se replican acá los mismos 5 nombres.
const UMBRALES_POR_DEFECTO = {
  rd_umbral_ok: 1.0,
  rd_umbral_seguimiento: 0.4,
  rd_umbral_critico: 0.0,
  h_umbral_reperfilado: 1.6,
  reperfilado_descuento_rd: 0.8,
} as const

type ClaveUmbral = keyof typeof UMBRALES_POR_DEFECTO

const DESCRIPCION: Record<EstadoDisco, string> = {
  OK: 'Sin alertas. Rd dentro de rango normal.',
  SEGUIMIENTO: 'Requiere observación periódica.',
  CAMBIO: 'Programar cambio del disco.',
  CRITICO: 'Cambio inmediato — disco fuera de límite.',
  REPERFILADO: 'Reperfilado viable antes del próximo cambio.',
}

const ORDEN: EstadoDisco[] = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO']

function formatoRd(valor: number): string {
  return valor.toFixed(2)
}

// Rango + línea técnica por estado, calculados a partir de los umbrales reales
// (useSystemParams, mismo hook/rol que PanelParametros) — replica el patrón de
// EVA-Aldy (leyenda de rangos con valores dinámicos de configuración), pero
// con Rd y los 5 estados propios de EVA en vez de diámetro en mm y 4 estados.
function calcularRangoYTecnico(estado: EstadoDisco, u: Record<ClaveUmbral, number>) {
  switch (estado) {
    case 'OK':
      return {
        rango: `Rd ≥ ${formatoRd(u.rd_umbral_ok)}`,
        tecnico: `rd_umbral_ok = ${formatoRd(u.rd_umbral_ok)}`,
      }
    case 'SEGUIMIENTO':
      return {
        rango: `${formatoRd(u.rd_umbral_seguimiento)} < Rd < ${formatoRd(u.rd_umbral_ok)}`,
        tecnico: `rd_umbral_seguimiento = ${formatoRd(u.rd_umbral_seguimiento)} · rd_umbral_ok = ${formatoRd(u.rd_umbral_ok)}`,
      }
    case 'CAMBIO':
      return {
        rango: `${formatoRd(u.rd_umbral_critico)} < Rd ≤ ${formatoRd(u.rd_umbral_seguimiento)}`,
        tecnico: `rd_umbral_critico = ${formatoRd(u.rd_umbral_critico)} · rd_umbral_seguimiento = ${formatoRd(u.rd_umbral_seguimiento)}`,
      }
    case 'CRITICO':
      return {
        rango: `Rd ≤ ${formatoRd(u.rd_umbral_critico)}`,
        tecnico: `rd_umbral_critico = ${formatoRd(u.rd_umbral_critico)}`,
      }
    case 'REPERFILADO':
      return {
        rango: `H ≥ ${formatoRd(u.h_umbral_reperfilado)} y Rd − ${formatoRd(u.reperfilado_descuento_rd)} > ${formatoRd(u.rd_umbral_seguimiento)}`,
        tecnico: `h_umbral_reperfilado = ${formatoRd(u.h_umbral_reperfilado)} · reperfilado_descuento_rd = ${formatoRd(u.reperfilado_descuento_rd)}`,
      }
  }
}

export function LeyendaRangosDiscos() {
  const params = useSystemParams()

  const umbrales = { ...UMBRALES_POR_DEFECTO }
  for (const clave of Object.keys(UMBRALES_POR_DEFECTO) as ClaveUmbral[]) {
    const entrada = params.data?.find((p) => p.clave === clave)
    const valor = entrada ? Number(entrada.valor) : NaN
    if (Number.isFinite(valor)) umbrales[clave] = valor
  }

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h2 className="font-display text-base font-semibold uppercase tracking-[0.08em] text-concreto-oscuro">
        Leyenda — rangos de Rd
      </h2>
      <p className="mt-0.5 font-body text-sm text-concreto">
        Rango de Rd de cada estado. Umbrales configurables en Configuración → Mediciones.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ORDEN.map((estado) => {
          const meta = ESTADO_META[estado]
          const { rango, tecnico } = calcularRangoYTecnico(estado, umbrales)
          return (
            <div key={estado} className="flex items-start gap-3 rounded-glass-sm border border-concreto/15 bg-white/40 p-3">
              <span
                className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 shadow-[0_0_6px_currentColor]"
                style={{ backgroundColor: meta.cssVar, borderColor: meta.cssVar, color: meta.cssVar }}
                aria-hidden
              />
              <div className="min-w-0 space-y-1">
                <p className="font-body text-base font-semibold leading-tight text-concreto-oscuro">{meta.etiqueta}</p>
                <p className="font-body text-sm leading-snug text-concreto">{DESCRIPCION[estado]}</p>
                <p className="font-data text-sm leading-snug text-concreto-oscuro">
                  <span className="font-semibold">Rango:</span> {rango}
                </p>
                <p className="font-data text-xs text-concreto">{tecnico}</p>
              </div>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
