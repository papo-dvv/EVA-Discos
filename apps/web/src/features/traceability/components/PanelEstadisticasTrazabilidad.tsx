import { Widget } from '../../../components/Widget'
import { DESCRIPCION_ASIMETRIA, ETIQUETA_ASIMETRIA, GLIFO_ASIMETRIA } from '../asimetria'
import type { AsimetriaResumen, EstadisticasGenerales } from '../types'

type Props = {
  estadisticas: EstadisticasGenerales
  asimetria: AsimetriaResumen
  conteoTotalHistorico: number
  conteoMostradoEnPeriodo: number
  etiquetaPeriodo: string
  // Mismo valor que estadisticas.conteo (ver TraceabilitySummaryResult,
  // backend) pero expuesto en la raíz del summary — se pasa tal cual, sin
  // recalcularlo acá, para la card "Pares Tras Recorte".
  paresTrasRecorte: number
}

export function PanelEstadisticasTrazabilidad({
  estadisticas,
  asimetria,
  conteoTotalHistorico,
  conteoMostradoEnPeriodo,
  etiquetaPeriodo,
  paresTrasRecorte,
}: Props) {
  return (
    <>
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">Estadísticas generales</h3>
      <p className="mb-3 font-body text-xs text-concreto">
        <span className="font-data text-concreto-oscuro">{conteoTotalHistorico}</span> históricos · mostrando{' '}
        <span className="font-data text-concreto-oscuro">{conteoMostradoEnPeriodo}</span> ({etiquetaPeriodo})
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Widget tamano="s" etiqueta="Media" valor={estadisticas.media.toFixed(4)} />
        <Widget tamano="s" etiqueta="Mediana" valor={estadisticas.mediana.toFixed(4)} />
        <Widget tamano="s" etiqueta="Moda" valor={estadisticas.moda.toFixed(4)} />
        <Widget tamano="s" etiqueta="Desv. estándar" valor={estadisticas.desviacionEstandar.toFixed(4)} />
        <Widget tamano="s" etiqueta="Mínimo" valor={estadisticas.minimo.toFixed(4)} />
        <Widget tamano="s" etiqueta="Máximo" valor={estadisticas.maximo.toFixed(4)} />
        <Widget tamano="s" etiqueta="Pares Tras Recorte" valor={paresTrasRecorte} />

        {/* Exclusivo de Trazabilidad (no Tasa de Desgaste ni otro panel).
            Ícono/flecha de apoyo en vez de color: NO usa los colores
            semánticos de estado de disco (OK/Cambio/Crítico) — esto es una
            propiedad de la forma de la distribución, no un estado de salud. */}
        <Widget tamano="s" etiqueta="Asimetría" glifo={asimetria.clasificacion ? GLIFO_ASIMETRIA[asimetria.clasificacion] : '—'} className="col-span-2">
          {asimetria.coeficiente === null || asimetria.clasificacion === null ? (
            <p className="font-body text-sm text-concreto">— Datos insuficientes para calcularla.</p>
          ) : (
            <>
              <div className="font-data text-[2rem] leading-none font-semibold tracking-tight text-concreto-oscuro">
                {asimetria.coeficiente.toFixed(2)}
              </div>
              <p className="mt-1.5 font-body text-sm font-semibold text-concreto-oscuro">
                {ETIQUETA_ASIMETRIA[asimetria.clasificacion]}
              </p>
              <p className="mt-0.5 font-body text-[0.6875rem] text-concreto">
                {DESCRIPCION_ASIMETRIA[asimetria.clasificacion]}
              </p>
            </>
          )}
        </Widget>
      </div>
      {/* Las tarjetas de arriba se calculan sobre datos LIMPIOS (post-recorte/
          exclusión del consenso — ver "Métodos y límites"), no sobre el valor
          crudo: por eso Mínimo/Máximo coinciden con el límite de consenso, y
          Media da un número mucho menor que el promedio crudo sin limitar. */}
      <p className="mt-2.5 font-body text-[0.6875rem] text-concreto">
        Todo lo de arriba es sobre datos limpios (post-recorte/exclusión del consenso de "Métodos y límites"), no
        sobre el valor crudo.
      </p>
    </>
  )
}
