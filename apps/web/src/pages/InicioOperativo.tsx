import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Package, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { IndicadorVariacion } from '../components/IndicadorVariacion'
import { SegmentedControl } from '../components/SegmentedControl'
import { CardsTrenesCriticos } from '../features/dashboard/components/CardsTrenesCriticos'
import { DonutTrenesCriticos } from '../features/dashboard/components/DonutTrenesCriticos'
import { GraficoConsumoDiscos } from '../features/dashboard/components/GraficoConsumoDiscos'
import { GraficoConsumoDiscosAcumulado } from '../features/dashboard/components/GraficoConsumoDiscosAcumulado'
import { GraficoTasaPorCoche } from '../features/dashboard/components/GraficoTasaPorCoche'
import { FABRICANTE_TREN_A_MODELO, type FabricanteTren } from '../features/fleet/components/fabricante'
import { useResumenTrenesCriticos } from '../features/fleet/queries'
import { useCambiosRealesPorMes, useRetirosPorMes, useStatsInventario } from '../features/inventory/queries'
import { useSubidasRecientesCount } from '../features/new-measurement/queries'
import { useProyeccionDiscos, usePronostico } from '../features/projection/queries'
import type { PronosticoMes } from '../features/projection/types'
import { useTraceabilitySeriesPorTipoCoche } from '../features/traceability/queries'
import { useWearRateChart, useWearRatePairs } from '../features/wear-rate/queries'
import './inicio.css'

const OPCIONES_FABRICANTE: { valor: FabricanteTren; etiqueta: string }[] = [
  { valor: 'ALSTOM', etiqueta: 'Alstom' },
  { valor: 'ANSALDO', etiqueta: 'Ansaldo' },
]

// Imágenes de coche por tarjeta KPI, calcadas de EVA-Aldy (ver
// styles-eva/dashboard-styles.md): las 3 primeras cards del dashboard son
// fotográficas y cambian según el fabricante activo del toggle.
const IMAGENES_TARJETA: Record<FabricanteTren, { tasaMensual: string; kmProyectado: string; cambioReal: string }> = {
  ALSTOM: {
    tasaMensual: '/images/cardcochealstom1.png',
    kmProyectado: '/images/cardcochealstom2.png',
    cambioReal: '/images/cardcochealstom6.png',
  },
  ANSALDO: {
    tasaMensual: '/images/cardcocheab1.png',
    kmProyectado: '/images/cardcocheab2.png',
    cambioReal: '/images/cardcocheab6.png',
  },
}

const FORMATO_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })
const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })
const fechaMes = (mes: string) => new Date(`${mes}-01T12:00:00`)
const moverMes = (mes: string, paso: number) => {
  const fecha = fechaMes(mes)
  fecha.setMonth(fecha.getMonth() + paso)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}
const posicion = (p: { tipoCoche: string; numeroCoche: number; bogieCodigo: string; ejeNumero: number; lado: string }) => `${p.tipoCoche} ${p.numeroCoche} · ${p.bogieCodigo} E${p.ejeNumero} ${p.lado === 'izquierdo' ? 'I' : 'D'}`

export function InicioOperativo() {
  const [indiceMes, setIndiceMes] = useState(0)
  const [fabricante, setFabricante] = useState<FabricanteTren>('ALSTOM')
  const imagenes = IMAGENES_TARJETA[fabricante]
  const tasaMensual = useWearRateChart()
  const pares = useWearRatePairs({ page: 1, pageSize: 200, sortBy: 'fecha2', sortDir: 'desc' })
  const urgentes = useProyeccionDiscos({ page: 1, pageSize: 200, estado: ['CRITICO', 'CAMBIO'] })
  const pronostico = usePronostico(undefined, 12)
  const cambiosReales = useCambiosRealesPorMes()
  const statsInventario = useStatsInventario()
  const tasaPorCoche = useTraceabilitySeriesPorTipoCoche()
  const retiros = useRetirosPorMes()
  const resumenTrenesCriticos = useResumenTrenesCriticos(FABRICANTE_TREN_A_MODELO[fabricante])
  const subidasRecientes = useSubidasRecientesCount()
  const kmPorDisco = useMemo(() => {
    const valores = (pares.data?.rows ?? []).map((par) => par.kmMensualUsado).filter(Number.isFinite)
    return valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : null
  }, [pares.data])
  const meses = pronostico.data ?? []
  const base = meses[0]?.mes ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const activo = moverMes(base, Math.max(0, Math.min(indiceMes, Math.max(meses.length - 1, 0))))
  const mesActivo: PronosticoMes | undefined = meses.find((mes) => mes.mes === activo) ?? meses[0]
  const urgentesOrdenados = useMemo(() => [...(urgentes.data?.rows ?? [])].sort((a, b) => (a.cicloCambio?.fechaEstimada ?? '9999').localeCompare(b.cicloCambio?.fechaEstimada ?? '9999') || a.rd - b.rd).slice(0, 3), [urgentes.data])
  const maximo = Math.max(...meses.map((mes) => mes.cambios + mes.reperfilados), 1)

  // Variación de tasa de desgaste vs. el mes anterior (últimos 2 meses YA
  // CERRADOS de la serie — ver fix de WearRateService: el mes en curso nunca
  // aparece con dato, así que .at(-1)/.at(-2) siempre comparan meses reales).
  const tasaValores = (tasaMensual.data ?? []).map((p) => p.tasaMensualPromedio).filter((v): v is number => v !== null)
  const tasaActual = tasaValores.at(-1) ?? null
  const tasaAnterior = tasaValores.at(-2) ?? null
  const deltaTasa = tasaActual !== null && tasaAnterior ? ((tasaActual - tasaAnterior) / tasaAnterior) * 100 : null

  // % de cambios reales ejecutados vs. proyectados, ambos acotados al MISMO
  // mes (mesActivo) — a diferencia del cálculo anterior, que comparaba el
  // backlog total de discos en cambio/crítico de toda la flota contra el
  // proyectado de un solo mes (peras con naranjas). cambiosReales cuenta por
  // EJE, igual que mesActivo.cambios (ver InventoryService.obtenerCambiosRealesPorMes).
  const buscarCambiosReales = (mes: string) => cambiosReales.data?.find((p) => p.mes === mes)?.cambiosReales ?? 0
  const realesDelMes = mesActivo ? buscarCambiosReales(mesActivo.mes) : 0
  const pctCambioMes = mesActivo?.cambios ? Math.round((realesDelMes / mesActivo.cambios) * 100) : null
  // El pronóstico (`meses`) solo trae el mes en curso hacia adelante (ver
  // comentario de mesPivote más abajo) — nunca tiene un "proyectado" para un
  // mes YA PASADO, así que no se puede recalcular el % del mes anterior con
  // el mismo criterio. En su lugar, la variación compara el conteo de
  // cambios REALES (dato que sí existe para cualquier mes cerrado, vía
  // useCambiosRealesPorMes) contra el mes anterior — sigue respondiendo
  // "¿voy mejor o peor que el mes pasado?", con datos que de verdad existen.
  const mesAnteriorStr = mesActivo ? moverMes(mesActivo.mes, -1) : null
  const realesDelMesAnterior = mesAnteriorStr ? buscarCambiosReales(mesAnteriorStr) : 0
  const deltaCambio = realesDelMesAnterior > 0 ? ((realesDelMes - realesDelMesAnterior) / realesDelMesAnterior) * 100 : null

  const stockAlmacen = statsInventario.data?.almacen ?? 0
  const stockTaller = statsInventario.data?.taller ?? 0
  // mes[0] del pronóstico es siempre el mes en curso (ver
  // generarMesesForecast) — misma fuente que ya usa CardCritico en
  // Proyección para "ahora" (desde el fix de agregarMes: CRITICO ahí SÍ
  // refleja el estado real, no interpolado).
  const criticoAhora = meses[0]?.desgloseEstado.critico ?? 0
  const cambioAhora = meses[0]?.desgloseEstado.cambio ?? 0

  return <main className="inicio px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[112rem]">
    <header className="inicio__cabecera"><div><p className="inicio__eyebrow"><Sparkles size={14} /> Centro de decisiones</p><h1>Estado de discos</h1><p>Lectura dinámica de desgaste, kilometraje y cambios de la flota.</p></div><SegmentedControl ariaLabel="Filtrar por fabricante" opciones={OPCIONES_FABRICANTE} valor={fabricante} onCambiar={(v) => setFabricante(v)} /></header>
    <section className="inicio__grid" aria-label="Resumen operativo de discos">
      <div className="inicio-cards-coche" aria-label="Indicadores principales de la flota">
      <article className="inicio-card inicio-card--foto [container-type:inline-size]">
        <div className="inicio-card__foto">
          <img src={imagenes.tasaMensual} alt="" aria-hidden="true" className="inicio-card__foto-img" />
          <p className={`inicio-card__foto-titulo top-[32%] ${fabricante === 'ALSTOM' ? 'left-[56%]' : 'left-[55%]'}`}>Tasa promedio por mes</p>
          <div className={`inicio-card__foto-valor top-[63.5%] ${fabricante === 'ALSTOM' ? 'left-[58%]' : 'left-[57%]'}`}>
            <AnimatedNumber valor={tasaActual} decimales={3} sufijo=" mm" />
            <IndicadorVariacion porcentaje={deltaTasa} sentido="subirEsMalo" />
          </div>
        </div>
      </article>
      <article className="inicio-card inicio-card--foto [container-type:inline-size]">
        <div className="inicio-card__foto">
          <img src={imagenes.kmProyectado} alt="" aria-hidden="true" className="inicio-card__foto-img" />
          <p className="inicio-card__foto-titulo left-[55%] top-[31%]">Km de vida útil por disco</p>
          <div className="inicio-card__foto-valor left-[57%] top-[63.5%]"><AnimatedNumber valor={kmPorDisco} sufijo=" km" /></div>
        </div>
      </article>
      <article className="inicio-card inicio-card--foto [container-type:inline-size]">
        <div className="inicio-card__foto">
          <img src={imagenes.cambioReal} alt="" aria-hidden="true" className="inicio-card__foto-img" />
          <p className={`inicio-card__foto-titulo ${fabricante === 'ALSTOM' ? 'left-[51%] top-[35%]' : 'left-[49%] top-[31%]'}`}>Cambio real vs. proyectado</p>
          <div className={`inicio-card__foto-valor ${fabricante === 'ALSTOM' ? 'left-[52%] top-[61%]' : 'left-[50%] top-[57%]'}`}>
            {pctCambioMes === null ? '—' : <AnimatedNumber valor={pctCambioMes} sufijo="%" />}
            <IndicadorVariacion porcentaje={deltaCambio} sentido="subirEsBueno" />
          </div>
        </div>
        <p className="inicio-card__subtexto">{realesDelMes} reales · {mesActivo?.cambios ?? 0} proyectados{mesActivo ? ` · ${FORMATO_MES.format(fechaMes(mesActivo.mes))}` : ''}</p>
      </article>
      </div>
      <article className="inicio-card inicio-card--urgente"><div className="inicio-card__encabezado"><span><span className="inicio-card__alerta" /> Prioridad de cambio</span><Link to="/proyeccion" aria-label="Ver todos los discos prioritarios"><ChevronRight size={17} /></Link></div><div className="urgentes-lista">{urgentesOrdenados.length ? urgentesOrdenados.map((disco) => <Link to="/proyeccion" className="urgente" key={disco.discId}><span className="disco-3d" aria-hidden><i /></span><span><b>Tren {disco.trenNumero}</b><small>{posicion(disco.posicion)}</small></span><time>{disco.cicloCambio ? FORMATO_FECHA.format(new Date(disco.cicloCambio.fechaEstimada)) : 'revisar'}</time></Link>) : <p className="inicio-card__vacio">Sin discos críticos o en cambio para priorizar.</p>}</div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><CalendarDays size={16} /> Cambios por fecha</span><span className="inicio-card__periodo">12 meses</span></div><div className="calendario-control"><button type="button" onClick={() => setIndiceMes((valor) => Math.max(0, valor - 1))} aria-label="Mes anterior"><ArrowLeft size={16} /></button><strong>{mesActivo ? FORMATO_MES.format(fechaMes(mesActivo.mes)) : 'Cargando…'}</strong><button type="button" onClick={() => setIndiceMes((valor) => Math.min(meses.length - 1, valor + 1))} aria-label="Mes siguiente"><ArrowRight size={16} /></button></div><div className="calendario-resumen"><span><b><AnimatedNumber valor={mesActivo?.cambios ?? 0} /></b> cambios</span><span><b><AnimatedNumber valor={mesActivo?.reperfilados ?? 0} /></b> reperfilados</span></div><div className="calendario-barras" aria-label="Intensidad de cambios previstos por mes">{meses.slice(0, 8).map((mes) => <span key={mes.mes} data-activo={mes.mes === mesActivo?.mes} style={{ height: `${Math.max(10, ((mes.cambios + mes.reperfilados) / maximo) * 100)}%` }} />)}</div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><Package size={16} /> Stock de discos</span><Link to="/inventario" aria-label="Abrir inventario"><ChevronRight size={17} /></Link></div><div className="flota-contenido"><div className="rueda-3d" aria-hidden><span /></div><div><strong><AnimatedNumber valor={stockAlmacen + stockTaller} /></strong><p>discos en stock</p><div className="flota-leyenda"><span data-estado="ok">{stockAlmacen} Almacén</span><span data-estado="seguimiento">{stockTaller} Taller</span></div></div></div></article>
    </section>

    <section className="mt-6 space-y-4" aria-label="Gráficos del dashboard">
      <GraficoTasaPorCoche puntos={tasaPorCoche.data ?? []} promedioFlota={tasaMensual.data ?? []} cargando={tasaPorCoche.isLoading} />
      <GraficoConsumoDiscos
        retirados={retiros.data}
        reales={cambiosReales.data}
        proyeccion={meses}
        cargando={retiros.isLoading || cambiosReales.isLoading || pronostico.isLoading}
      />
      <GraficoConsumoDiscosAcumulado
        retirados={retiros.data}
        reales={cambiosReales.data}
        proyeccion={meses}
        cargando={retiros.isLoading || cambiosReales.isLoading || pronostico.isLoading}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutTrenesCriticos critico={criticoAhora} cambio={cambioAhora} cargando={pronostico.isLoading} />
        <CardsTrenesCriticos
          resumen={resumenTrenesCriticos.data}
          subidasRecientes={subidasRecientes.data}
          cargando={resumenTrenesCriticos.isLoading}
        />
      </div>
    </section>
  </div></main>
}
