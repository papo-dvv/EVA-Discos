import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { GlassSurface } from '../../../components/GlassSurface'
import { Widget } from '../../../components/Widget'
import type { SystemParamItem } from '../../system-params/api'
import { AvisoAjusteConsenso } from '../../system-params/components/AvisoAjusteConsenso'
import { FilaParametro } from '../../system-params/components/FilaParametro'
import { useSystemParams } from '../../system-params/queries'
import { claveFilaConEstado, useConfirmacionParametro } from '../../system-params/useConfirmacionParametro'
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

// Los 4 únicos parámetros configurables del cálculo de consenso (Gauss y
// Tukey quedan fijos, ver traceability-stats.service.ts) — mismas claves que
// ORDEN_GRUPO_CONSENSO en PanelParametros, en el mismo orden.
const CLAVES_PERCENTILES = [
  'percentil_limite_inferior',
  'percentil_limite_superior',
  'percentil_extremo_inferior',
  'percentil_extremo_superior',
]
const CLAVE_AMPLITUD_MAXIMA_EXTREMO = 'amplitud_maxima_extremo'

function formatearRango(inferior: number, superior: number): string {
  return `${inferior.toFixed(4)} … ${superior.toFixed(4)}`
}

// Fórmulas y valores de los 3 métodos, con el consenso claramente
// diferenciado (recuadro verde) del resto — es el que efectivamente clasifica
// los puntos del gráfico (ver GraficoTrazabilidad / clasificarYLimpiarSerie
// en el backend). Los 4 percentiles de consenso + amplitud_maxima_extremo son
// editables acá mismo (input+Guardar+ConfirmDialog, igual patrón que
// PanelParametros en Migración/Mediciones/Tasa de desgaste) — Gauss y Tukey
// no tienen parámetro configurable, así que sus tarjetas quedan de solo
// lectura.
export function PanelMetodosTrazabilidad({
  conteo,
  gauss,
  percentiles,
  tukey,
  consenso,
  clasificacionAsimetria,
}: Props) {
  const porMetodo = { gauss, percentiles, tukey }
  const queryClient = useQueryClient()
  const params = useSystemParams()
  const { actualizar, confirmando, setConfirmando, avisoAjuste, setAvisoAjuste, confirmar } =
    useConfirmacionParametro(() => queryClient.invalidateQueries({ queryKey: ['traceability'] }))

  const porClave = new Map((params.data ?? []).map((p) => [p.clave, p]))
  const paramsPercentiles = CLAVES_PERCENTILES.map((c) => porClave.get(c)).filter(
    (p): p is SystemParamItem => p !== undefined,
  )
  const paramAmplitud = porClave.get(CLAVE_AMPLITUD_MAXIMA_EXTREMO)

  function solicitarConfirmacion(p: SystemParamItem, nuevo: string) {
    setConfirmando({ clave: p.clave, anterior: p.valor, nuevo })
  }

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
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

      {avisoAjuste && (
        <AvisoAjusteConsenso
          clave={avisoAjuste.clave}
          ajustes={avisoAjuste.ajustes}
          onCerrar={() => setAvisoAjuste(null)}
        />
      )}

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

              {/* Únicos 4 parámetros configurables del consenso — ver
                  CLAVES_PERCENTILES. Cambiar cualquiera recalcula gauss/
                  percentiles/tukey/consenso en el próximo fetch de esta
                  pantalla (onExito invalida ['traceability'] más abajo). */}
              {clave === 'percentiles' && paramsPercentiles.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-concreto/10 pt-2.5">
                  {paramsPercentiles.map((p) => (
                    <FilaParametro
                      key={claveFilaConEstado(p, actualizar)}
                      param={p}
                      onGuardar={(nuevo) => solicitarConfirmacion(p, nuevo)}
                    />
                  ))}
                </div>
              )}
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

      {paramAmplitud && (
        <div className="mt-3 rounded-2xl border border-concreto/15 bg-white/40 p-3">
          <p className="font-body text-sm font-semibold text-concreto-oscuro">Amplitud máxima del extremo</p>
          <p className="mt-0.5 font-body text-[0.6875rem] text-concreto">
            Rechaza un cambio de percentil si el extremo de consenso resultante supera esta amplitud. Vacío = sin
            restricción.
          </p>
          <div className="mt-2.5">
            <FilaParametro
              key={claveFilaConEstado(paramAmplitud, actualizar)}
              param={paramAmplitud}
              permitirVacio
              onGuardar={(nuevo) => solicitarConfirmacion(paramAmplitud, nuevo)}
            />
          </div>
        </div>
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar cambio de parámetro"
          textoConfirmar="Sí, cambiar"
          onConfirm={confirmar}
          onCerrar={() => setConfirmando(null)}
          mensaje={
            <>
              ¿Seguro que quieres cambiar <span className="font-data">{confirmando.clave}</span> de{' '}
              <b className="font-data">{confirmando.anterior}</b> a <b className="font-data">{confirmando.nuevo}</b>?
              Esto afecta cómo se clasifican los puntos de trazabilidad de <b>toda la flota</b>.
            </>
          }
        />
      )}
    </GlassSurface>
  )
}
