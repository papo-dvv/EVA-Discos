import { AlertOctagon, FileUp, Gauge, Info, Ruler, TrainFront, TriangleAlert } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import type { ResumenTrenesCriticos } from '../../fleet/types'

type Props = {
  resumen: ResumenTrenesCriticos | undefined
  subidasRecientes: number | undefined
  cargando: boolean
}

type CardStat = {
  icono: typeof TrainFront
  etiqueta: string
  tooltip: string
  valor: string
  detalle?: string
}

function Card({ icono: Icono, etiqueta, tooltip, valor, detalle }: CardStat) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icono size={15} className="text-concreto-oscuro" aria-hidden />
        <span className="font-body text-xs font-semibold uppercase tracking-wide text-concreto">{etiqueta}</span>
        <WarningTooltip texto={tooltip}>
          <Info size={13} className="text-concreto" aria-label="Más información" />
        </WarningTooltip>
      </div>
      <strong className="block font-data text-2xl text-concreto-oscuro">{valor}</strong>
      {detalle && <p className="mt-1 font-body text-xs text-concreto">{detalle}</p>}
    </GlassSurface>
  )
}

// 6 cards de "Trenes Críticos" (columna izquierda: estado de flota; derecha:
// actividad/promedios) — todas alimentadas por FleetService.resumenTrenesCriticos
// (fabricante-aware, a diferencia de Proyección) salvo "Archivos subidos", que
// es fleet-wide por definición (actividad de carga, no de flota).
export function CardsTrenesCriticos({ resumen, subidasRecientes, cargando }: Props) {
  const formatoRd = (rd: number | null | undefined) => (rd !== null && rd !== undefined ? `${rd.toFixed(2)} mm` : '—')

  const izquierda: CardStat[] = [
    {
      icono: TrainFront,
      etiqueta: 'Trenes con ruedas críticas',
      tooltip: 'Cantidad de trenes con al menos un disco en estado Crítico o Cambio.',
      valor: cargando ? '—' : String(resumen?.trenesConDiscosCriticos ?? 0),
    },
    {
      icono: TriangleAlert,
      etiqueta: 'Tren más crítico',
      tooltip: 'Score compuesto: discos en Crítico (peso alto) + discos en Cambio (peso menor), desempate por menor Rd.',
      valor: cargando || !resumen?.trenMasCritico ? '—' : `Tren ${resumen.trenMasCritico.trenNumero}`,
      detalle: resumen?.trenMasCritico
        ? `${resumen.trenMasCritico.discosCriticos} crítico(s) · ${resumen.trenMasCritico.discosCambio} en cambio`
        : 'Sin trenes críticos ahora',
    },
    {
      icono: Ruler,
      etiqueta: 'Disco con menor vida útil (Rd)',
      tooltip: 'Disco activo en servicio con el menor Rd (T-H) de toda la selección actual.',
      valor: cargando ? '—' : formatoRd(resumen?.discoMenorRd?.rd),
      detalle: resumen?.discoMenorRd
        ? `Tren ${resumen.discoMenorRd.trenNumero}` +
          (resumen.discoMenorRd.codigoDisco ? ` · ${resumen.discoMenorRd.codigoDisco}` : '')
        : undefined,
    },
  ]

  const derecha: CardStat[] = [
    {
      icono: AlertOctagon,
      etiqueta: 'Discos críticos totales',
      tooltip: 'Suma de discos en estado Crítico y Cambio, según el fabricante seleccionado arriba.',
      valor: cargando ? '—' : String(resumen?.discosCriticosTotales ?? 0),
    },
    {
      icono: FileUp,
      etiqueta: 'Archivos subidos (mediciones)',
      tooltip: 'Fichas de medición confirmadas subidas en los últimos 30 días, fleet-wide.',
      valor: subidasRecientes === undefined ? '—' : String(subidasRecientes),
      detalle: 'Últimos 30 días',
    },
    {
      icono: Gauge,
      etiqueta: 'Promedio de medidas de discos',
      tooltip: 'Rd (T-H) promedio de todos los discos activos en servicio, según el fabricante seleccionado arriba.',
      valor: cargando ? '—' : formatoRd(resumen?.rdPromedio),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid grid-cols-1 gap-3">
        {izquierda.map((card) => (
          <Card key={card.etiqueta} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {derecha.map((card) => (
          <Card key={card.etiqueta} {...card} />
        ))}
      </div>
    </div>
  )
}
