import { Widget } from '../../../components/Widget'
import { ETIQUETA_ASIMETRIA, GLIFO_ASIMETRIA } from '../asimetria'
import type { ClasificacionAsimetria, ConsensoLimites, MetodoDescrito } from '../types'

type Props = {
  // Total de pares válidos (esValido=true) del alcance actual — el MISMO
  // conjunto crudo que alimenta a los 3 métodos (ver TraceabilityService.
  // obtenerSummary: gauss/percentiles/tukey se calculan sobre `valores`,
  // ninguno recorta su propia entrada). Es DISTINTO de
  // estadisticas.conteo (ese ya es posterior al recorte/exclusión del
  // consenso — ver PanelEstadisticasTrazabilidad).
  conteo: number
  gauss: MetodoDescrito
  percentiles: MetodoDescrito
  tukey: MetodoDescrito
  consenso: ConsensoLimites
  // Ver tarjeta "Asimetría" en PanelEstadisticasTrazabilidad — se reusa acá
  // solo para explicar el vínculo con los percentiles, null si el backend no
  // pudo calcularla (n<3, no debería pasar en la práctica).
  clasificacionAsimetria: ClasificacionAsimetria | null
}

const METODOS: { clave: 'gauss' | 'percentiles' | 'tukey'; nombre: string }[] = [
  { clave: 'gauss', nombre: 'Gauss' },
  { clave: 'percentiles', nombre: 'Percentiles' },
  { clave: 'tukey', nombre: 'Tukey' },
]

function formatearRango(inferior: number, superior: number): string {
  return `${inferior.toFixed(4)} … ${superior.toFixed(4)}`
}

// Fórmulas y valores de los 3 métodos, con el consenso claramente
// diferenciado (recuadro verde) del resto — es el que efectivamente clasifica
// los puntos del gráfico (ver GraficoTrazabilidad / clasificarYLimpiarSerie
// en el backend). La configuración se administra en la card independiente
// Parámetros de Trazabilidad, para no duplicar controles en esta vista.
export function PanelMetodosTrazabilidad({
  conteo,
  gauss,
  percentiles,
  tukey,
  consenso,
  clasificacionAsimetria,
}: Props) {
  const porMetodo = { gauss, percentiles, tukey }

  return (
    <>
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">Métodos y límites</h3>
      <p className="mb-3 font-body text-xs text-concreto">Calculados sobre el histórico completo del alcance actual.</p>

      {/* Vínculo con la tarjeta "Asimetría" (PanelEstadisticasTrazabilidad):
          solo se muestra cuando hay sesgo real, para no saturar el panel
          cuando la distribución es simétrica (ahí no hay nada que explicar). */}
      {clasificacionAsimetria && clasificacionAsimetria !== 'SIMETRICA' && (
        <p className="mb-3 font-body text-[0.6875rem] text-concreto">
          {GLIFO_ASIMETRIA[clasificacionAsimetria]} Esta distribución tiene {ETIQUETA_ASIMETRIA[
            clasificacionAsimetria
          ].toLowerCase()} (ver "Asimetría" en Estadísticas generales) — por eso los percentiles no quedan
          centrados en la mediana, y el límite y el extremo de consenso pueden verse distintos entre sí.
        </p>
      )}

      <Widget
        className="mb-3"
        tamano="s"
        etiqueta="Datos considerados"
        valor={conteo}
        pie="Pares válidos usados por Gauss, Percentiles y Tukey"
      />

      <div className="space-y-2.5">
        {METODOS.map(({ clave, nombre }) => {
          const m = porMetodo[clave]
          return (
            <div key={clave} className="rounded-2xl border border-concreto/15 bg-white/40 p-3">
              <p className="font-body text-sm font-semibold text-concreto-oscuro">{nombre}</p>
              <p className="mt-0.5 font-body text-[0.6875rem] text-concreto">{m.formula}</p>
              <dl className="mt-2 space-y-1 font-data text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-concreto">Límite</dt>
                  <dd className="text-concreto-oscuro">{formatearRango(m.limiteInferior, m.limiteSuperior)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-concreto">Extremo</dt>
                  <dd className="text-concreto-oscuro">{formatearRango(m.extremoInferior, m.extremoSuperior)}</dd>
                </div>
              </dl>

            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-verde-institucional/30 bg-verde-claro/40 p-3">
        <p className="font-body text-sm font-semibold text-verde-oscuro">Consenso</p>
        <p className="mt-0.5 font-body text-[0.6875rem] text-concreto">
          El más conservador de los 3 métodos en cada extremo — es el que clasifica los puntos del gráfico.
        </p>
        <dl className="mt-2 space-y-1 font-data text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-concreto">Límite</dt>
            <dd className="text-verde-oscuro">
              {formatearRango(consenso.limiteConsenso.inferior, consenso.limiteConsenso.superior)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-concreto">Extremo</dt>
            <dd className="text-[color:var(--color-estado-seguimiento)]">
              {formatearRango(consenso.extremoConsenso.inferior, consenso.extremoConsenso.superior)}
            </dd>
          </div>
        </dl>
      </div>

    </>
  )
}
