import { CalendarClock, CheckCircle2, Package, TrainFront, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { useFleetSummary } from '../../fleet/queries'
import { useCambiosDiscoAnio, useStatsInventario } from '../../inventory/queries'
import { usePronostico, useProyeccionDiscos } from '../queries'

const FORMATO_MES = new Intl.DateTimeFormat('es-PE', { month: 'long' })
const anioActual = new Date().getFullYear()

type Props = {
  readonly titulo: string
  readonly valor: ReactNode
  readonly detalle: string
  readonly icono: LucideIcon
  readonly colorVar: string
  readonly alerta?: boolean
  readonly to?: string
  readonly cta?: string
}

function TarjetaAnalisis({ titulo, valor, detalle, icono: Icono, colorVar, alerta, to, cta }: Props) {
  return (
    <GlassSurface
      fuerte
      className="flex flex-col justify-between gap-3 rounded-glass border-l-4 p-4"
      style={{ borderLeftColor: alerta ? 'var(--color-estado-critico)' : colorVar }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-concreto">{titulo}</p>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${alerta ? 'var(--color-estado-critico)' : colorVar} 15%, transparent)` }}
        >
          <Icono size={17} style={{ color: alerta ? 'var(--color-estado-critico)' : colorVar }} aria-hidden />
        </span>
      </div>
      <div>
        <p
          className="font-data text-2xl font-bold"
          style={{ color: alerta ? 'var(--color-estado-critico)' : 'var(--color-concreto-oscuro)' }}
        >
          {valor}
        </p>
        <p className="mt-1 font-body text-xs text-concreto">{detalle}</p>
      </div>
      {to && cta && (
        <Link to={to} className="font-body text-xs font-semibold text-verde-institucional hover:underline">
          {cta} →
        </Link>
      )}
    </GlassSurface>
  )
}

// 5 cards de resumen del módulo de Proyección, inspiradas en
// ResumenMesProyeccion de EVA-Aldy pero adaptadas al modelo de EVA: se habla
// de "discos" (no "coches" — Alstom tiene 1 disco/lado, Ansaldo 2, no hay una
// conversión fija como las 8 ruedas/coche de EVA-Aldy) y no existe la card de
// "Reprogramados pendientes" (EVA no tiene concepto de posponer cambios).
export function ResumenAnalisisProyeccion() {
  const fleet = useFleetSummary()
  const pronostico = usePronostico(undefined, 12)
  const necesarios = useProyeccionDiscos({ page: 1, pageSize: 1, estado: ['CAMBIO', 'CRITICO'] })
  const stock = useStatsInventario()
  const cambiosAnio = useCambiosDiscoAnio()

  const cargando =
    fleet.isLoading || pronostico.isLoading || necesarios.isLoading || stock.isLoading || cambiosAnio.isLoading

  const meses = pronostico.data ?? []
  const totalAnio = meses.reduce((total, mes) => total + mes.cambios, 0)
  const proximoMes = meses[1]
  const nombreProximoMes = proximoMes ? FORMATO_MES.format(new Date(`${proximoMes.mes}-01T12:00:00`)) : '—'

  const trenesCriticos = (fleet.data ?? []).filter((t) => t.conteoEstado.critico > 0)
  const discosCriticos = trenesCriticos.reduce((total, t) => total + t.conteoEstado.critico, 0)

  const discosNecesarios = necesarios.data?.total ?? 0
  const discosStock = stock.data?.almacen ?? 0
  const faltan = discosNecesarios - discosStock

  const realizados = cambiosAnio.data?.total ?? 0
  const avance = totalAnio > 0 ? Math.round((realizados / totalAnio) * 100) : 0

  const valor = (n: number) => (cargando ? '…' : n)
  const etiquetaDiscosCriticos = discosCriticos === 1 ? 'disco crítico' : 'discos críticos'
  const detalleStock = faltan > 0 ? `faltan ${faltan} discos` : 'el almacén cubre lo pendiente'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <TarjetaAnalisis
        titulo="Trenes en estado crítico"
        valor={valor(trenesCriticos.length)}
        detalle={cargando ? '' : `${discosCriticos} ${etiquetaDiscosCriticos}`}
        icono={TrainFront}
        colorVar="var(--color-estado-critico)"
        alerta={trenesCriticos.length > 0}
      />
      <TarjetaAnalisis
        titulo={`Total proyectado ${anioActual}`}
        valor={valor(totalAnio)}
        detalle={`discos · cambios proyectados en ${anioActual}`}
        icono={CalendarClock}
        colorVar="var(--color-verde-institucional)"
      />
      <TarjetaAnalisis
        titulo="Próximo mes"
        valor={valor(proximoMes?.cambios ?? 0)}
        detalle={`discos a prever en ${nombreProximoMes}`}
        icono={CalendarClock}
        colorVar="var(--color-verde-institucional)"
      />
      <TarjetaAnalisis
        titulo="Discos necesarios vs stock"
        valor={cargando ? '…' : `${discosNecesarios} / ${discosStock}`}
        detalle={cargando ? '' : detalleStock}
        icono={Package}
        colorVar="var(--color-verde-institucional)"
        alerta={!cargando && faltan > 0}
        to="/inventario"
        cta="Ver inventario"
      />
      <TarjetaAnalisis
        titulo="Avance del año"
        valor={cargando ? '…' : `${avance}%`}
        detalle={cargando ? '' : `${realizados} de ${totalAnio} discos del ${anioActual}`}
        icono={CheckCircle2}
        colorVar="var(--color-estado-ok)"
      />
    </div>
  )
}
