import { GlassSurface } from '../../../components/GlassSurface'
import { Widget } from '../../../components/Widget'
import type { EstadisticasGenerales } from '../types'

type Props = {
  estadisticas: EstadisticasGenerales
  conteoTotalHistorico: number
  conteoMostradoEnPeriodo: number
  etiquetaPeriodo: string
}

export function PanelEstadisticasTrazabilidad({
  estadisticas,
  conteoTotalHistorico,
  conteoMostradoEnPeriodo,
  etiquetaPeriodo,
}: Props) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
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
      </div>
      {/* Las 6 tarjetas de arriba se calculan sobre datos LIMPIOS (post-recorte/
          exclusión del consenso — ver "Métodos y límites"), no sobre el valor
          crudo: por eso Mínimo/Máximo coinciden con el límite de consenso, y
          Media da un número mucho menor que el promedio crudo sin limitar. */}
      <p className="mt-2.5 font-body text-[0.6875rem] text-concreto">
        Todo lo de arriba es sobre datos limpios (post-recorte/exclusión del consenso de "Métodos y límites"), no
        sobre el valor crudo.
      </p>
    </GlassSurface>
  )
}
