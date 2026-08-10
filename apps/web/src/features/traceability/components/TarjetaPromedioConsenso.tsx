import type { ReactNode } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { Widget } from '../../../components/Widget'
import type { ConsensoLimites } from '../types'

// Tono "Seguimiento" de styles.md §6 (nunca el rojo de error): el cálculo es
// válido, solo poco respaldado. Mismo patrón visual que AvisoAjusteConsenso.
const ESTILO_AVISO = {
  borderColor: 'color-mix(in srgb, var(--color-estado-seguimiento) 45%, transparent)',
  background: 'color-mix(in srgb, var(--color-estado-seguimiento) 12%, transparent)',
}

function formatearRango(inferior: number, superior: number): string {
  return `${inferior.toFixed(4)} … ${superior.toFixed(4)}`
}

export type DatosPromedioConsenso = {
  conteo: number
  confiable: boolean
  consenso: ConsensoLimites | null
  conteoLimpio: number
  promedio: number | null
}

type Props = {
  titulo: string
  descripcion: ReactNode
  datos: DatosPromedioConsenso
  // Completa "Solo N par(es) {contexto} — se necesitan 20…" — cambia según la
  // card (ej. "en este rango", "en este tren").
  contexto: string
  mensajeVacio: string
}

// Card genérica de "promedio de dato limpio" (consenso propio del
// subconjunto -> recorte/exclusión -> promedio) — mismo cálculo que
// calcularPromedioConsenso en TraceabilityService (backend), reutilizada acá
// tal cual por PanelPromedioRangoKm y PanelPromedioPorTren para no duplicar
// el layout: un solo lugar para este patrón visual.
export function TarjetaPromedioConsenso({ titulo, descripcion, datos, contexto, mensajeVacio }: Props) {
  const { conteo, confiable, consenso, conteoLimpio, promedio } = datos

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">{titulo}</h3>
      <p className="mb-3 font-body text-xs text-concreto">{descripcion}</p>

      {!confiable && conteo > 0 && (
        <p role="status" className="mb-3 rounded-xl border px-3 py-2.5 font-body text-xs text-concreto-oscuro" style={ESTILO_AVISO}>
          ⚠ Solo <b className="font-data">{conteo}</b> {conteo === 1 ? 'par' : 'pares'} {contexto} — se necesitan 20
          para límites confiables. Los valores de abajo se calcularon igual, tomalos como referencia.
        </p>
      )}

      {consenso === null || promedio === null ? (
        <p className="font-body text-sm text-concreto">{mensajeVacio}</p>
      ) : (
        <>
          <Widget
            className="mb-2.5"
            tamano="s"
            etiqueta="Datos considerados"
            valor={conteo}
            pie="Pares usados por Gauss, Percentiles y Tukey"
          />

          <dl className="mb-3 space-y-1 font-data text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-concreto">Límite de consenso</dt>
              <dd className="text-concreto-oscuro">
                {formatearRango(consenso.limiteConsenso.inferior, consenso.limiteConsenso.superior)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-concreto">Extremo de consenso</dt>
              <dd className="text-concreto-oscuro">
                {formatearRango(consenso.extremoConsenso.inferior, consenso.extremoConsenso.superior)}
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-2.5">
            <Widget tamano="s" etiqueta="Pares tras recorte" valor={conteoLimpio} />
            <Widget tamano="s" etiqueta="Promedio" valor={promedio.toFixed(4)} />
          </div>
        </>
      )}
    </GlassSurface>
  )
}
