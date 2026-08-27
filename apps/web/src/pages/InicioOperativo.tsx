import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Disc3, Gauge, MapPin, Sparkles, TrendingDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { DonutTrenesCriticos } from '../features/dashboard/components/DonutTrenesCriticos'
import { GraficoFlujoMensualDiscos } from '../features/dashboard/components/GraficoFlujoMensualDiscos'
import { GraficoTasaPorCoche } from '../features/dashboard/components/GraficoTasaPorCoche'
import { useRetirosPorMes } from '../features/inventory/queries'
import { useProyeccionDiscos, usePronostico } from '../features/projection/queries'
import type { PronosticoMes } from '../features/projection/types'
import { useScanRecordsStats } from '../features/scan-records/queries'
import { useWearRateChart, useWearRateChartPorCoche, useWearRatePairs } from '../features/wear-rate/queries'
import './inicio.css'

const FORMATO_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })
const FORMATO_FECHA = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })
const fechaMes = (mes: string) => new Date(`${mes}-01T12:00:00`)
const moverMes = (mes: string, paso: number) => {
  const fecha = fechaMes(mes)
  fecha.setMonth(fecha.getMonth() + paso)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}
const numero = (valor: number | null | undefined) => valor == null || !Number.isFinite(valor) ? '—' : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(valor)
const tasa = (valor: number | null | undefined) => valor == null || !Number.isFinite(valor) ? '—' : `${valor.toFixed(3)} mm`
const posicion = (p: { tipoCoche: string; numeroCoche: number; bogieCodigo: string; ejeNumero: number; lado: string }) => `${p.tipoCoche} ${p.numeroCoche} · ${p.bogieCodigo} E${p.ejeNumero} ${p.lado === 'izquierdo' ? 'I' : 'D'}`

export function InicioOperativo() {
  const [indiceMes, setIndiceMes] = useState(0)
  const tasaMensual = useWearRateChart()
  const pares = useWearRatePairs({ page: 1, pageSize: 200, sortBy: 'fecha2', sortDir: 'desc' })
  const urgentes = useProyeccionDiscos({ page: 1, pageSize: 200, estado: ['CRITICO', 'CAMBIO'] })
  const pronostico = usePronostico(undefined, 12)
  const estados = useScanRecordsStats({}, { page: 1, pageSize: 1, vistaFecha: 'ultima' })
  const tasaPorCoche = useWearRateChartPorCoche()
  const retiros = useRetirosPorMes()
  const kmPorDisco = useMemo(() => {
    const valores = (pares.data?.rows ?? []).map((par) => par.kmMensualUsado).filter(Number.isFinite)
    return valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : null
  }, [pares.data])
  const meses = pronostico.data ?? []
  const base = meses[0]?.mes ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const activo = moverMes(base, Math.max(0, Math.min(indiceMes, Math.max(meses.length - 1, 0))))
  const mesActivo: PronosticoMes | undefined = meses.find((mes) => mes.mes === activo) ?? meses[0]
  const reales = (estados.data?.total.cambio ?? 0) + (estados.data?.total.critico ?? 0)
  const urgentesOrdenados = useMemo(() => [...(urgentes.data?.rows ?? [])].sort((a, b) => (a.cicloCambio?.fechaEstimada ?? '9999').localeCompare(b.cicloCambio?.fechaEstimada ?? '9999') || a.rd - b.rd).slice(0, 3), [urgentes.data])
  const maximo = Math.max(...meses.map((mes) => mes.cambios + mes.reperfilados), 1)
  // mes[0] del pronóstico es siempre el mes en curso (ver
  // generarMesesForecast) — mismo mes "pivote" que empalma con el último
  // punto de useRetirosPorMes en GraficoFlujoMensualDiscos, y la misma
  // fuente que ya usa CardCritico en Proyección para "ahora" (desde el fix
  // de agregarMes: CRITICO ahí SÍ refleja el estado real, no interpolado).
  const mesPivote = meses[0]?.mes ?? base
  const criticoAhora = meses[0]?.desgloseEstado.critico ?? 0
  const cambioAhora = meses[0]?.desgloseEstado.cambio ?? 0

  return <main className="inicio px-4 py-5 sm:px-6 lg:px-8"><div className="mx-auto max-w-[112rem]">
    <header className="inicio__cabecera"><div><p className="inicio__eyebrow"><Sparkles size={14} /> Centro de decisiones</p><h1>Estado de discos</h1><p>Lectura dinámica de desgaste, kilometraje y cambios de la flota.</p></div><Link to="/proyeccion" className="inicio__accion">Ver proyección completa <ChevronRight size={16} /></Link></header>
    <section className="inicio__grid" aria-label="Resumen operativo de discos">
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><TrendingDown size={16} /> Tasa promedio por mes</span><span className="inicio-card__vivo">En vivo</span></div><div className="inicio-card__metrica">{tasa(tasaMensual.data?.at(-1)?.tasaMensualPromedio)}</div><p className="inicio-card__subtexto">Desgaste mensual de pares válidos.</p><div className="mini-chart" aria-hidden>{(tasaMensual.data ?? []).slice(-7).map((punto, indice, lista) => <span key={punto.mes} style={{ height: `${Math.max(14, ((punto.tasaMensualPromedio ?? 0) / Math.max(...lista.map((p) => p.tasaMensualPromedio ?? 0), 1)) * 100)}%`, animationDelay: `${indice * 70}ms` }} />)}</div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><Gauge size={16} /> Km proyectados por disco</span><span className="inicio-card__periodo">/ mes</span></div><div className="inicio-card__metrica">{numero(kmPorDisco)} <small>km</small></div><p className="inicio-card__subtexto">Promedio configurado en las proyecciones activas.</p><div className="odometro" aria-hidden><i /><i /><i /><i /><i /></div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><Disc3 size={16} /> Cambio real / proyectado</span><span className="inicio-card__periodo">{mesActivo ? FORMATO_MES.format(fechaMes(mesActivo.mes)) : 'sin periodo'}</span></div><div className="comparador"><div><strong>{reales}</strong><span>reales</span></div><span className="comparador__linea" /><div><strong>{mesActivo?.cambios ?? 0}</strong><span>proyectados</span></div></div><p className="inicio-card__subtexto">Condición actual frente al mes seleccionado.</p></article>
      <article className="inicio-card inicio-card--urgente"><div className="inicio-card__encabezado"><span><span className="inicio-card__alerta" /> Prioridad de cambio</span><Link to="/proyeccion" aria-label="Ver todos los discos prioritarios"><ChevronRight size={17} /></Link></div><div className="urgentes-lista">{urgentesOrdenados.length ? urgentesOrdenados.map((disco) => <Link to="/proyeccion" className="urgente" key={disco.discId}><span className="disco-3d" aria-hidden><i /></span><span><b>Tren {disco.trenNumero}</b><small>{posicion(disco.posicion)}</small></span><time>{disco.cicloCambio ? FORMATO_FECHA.format(new Date(disco.cicloCambio.fechaEstimada)) : 'revisar'}</time></Link>) : <p className="inicio-card__vacio">Sin discos críticos o en cambio para priorizar.</p>}</div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><CalendarDays size={16} /> Cambios por fecha</span><span className="inicio-card__periodo">12 meses</span></div><div className="calendario-control"><button type="button" onClick={() => setIndiceMes((valor) => Math.max(0, valor - 1))} aria-label="Mes anterior"><ArrowLeft size={16} /></button><strong>{mesActivo ? FORMATO_MES.format(fechaMes(mesActivo.mes)) : 'Cargando…'}</strong><button type="button" onClick={() => setIndiceMes((valor) => Math.min(meses.length - 1, valor + 1))} aria-label="Mes siguiente"><ArrowRight size={16} /></button></div><div className="calendario-resumen"><span><b>{mesActivo?.cambios ?? 0}</b> cambios</span><span><b>{mesActivo?.reperfilados ?? 0}</b> reperfilados</span></div><div className="calendario-barras" aria-label="Intensidad de cambios previstos por mes">{meses.slice(0, 8).map((mes) => <span key={mes.mes} data-activo={mes.mes === mesActivo?.mes} style={{ height: `${Math.max(10, ((mes.cambios + mes.reperfilados) / maximo) * 100)}%` }} />)}</div></article>
      <article className="inicio-card"><div className="inicio-card__encabezado"><span><MapPin size={16} /> Condición de la flota</span><Link to="/mediciones" aria-label="Abrir mediciones"><ChevronRight size={17} /></Link></div><div className="flota-contenido"><div className="rueda-3d" aria-hidden><span /></div><div><strong>{numero(estados.data?.totalFilasSubidas)}</strong><p>discos con última medición</p><div className="flota-leyenda"><span data-estado="ok">{estados.data?.total.ok ?? 0} OK</span><span data-estado="seguimiento">{estados.data?.total.seguimiento ?? 0} seguimiento</span></div></div></div></article>
    </section>

    <section className="mt-6 space-y-4" aria-label="Gráficos del dashboard">
      <GraficoTasaPorCoche puntos={tasaPorCoche.data ?? []} cargando={tasaPorCoche.isLoading} />
      <DonutTrenesCriticos critico={criticoAhora} cambio={cambioAhora} cargando={pronostico.isLoading} />
      <GraficoFlujoMensualDiscos
        pasado={retiros.data}
        futuro={meses}
        cargando={retiros.isLoading || pronostico.isLoading}
        mesActual={mesPivote}
      />
    </section>
  </div></main>
}
