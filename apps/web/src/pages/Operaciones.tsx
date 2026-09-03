import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Boxes, CheckCircle2, Disc3, PackageMinus, ScanLine, ShieldCheck } from 'lucide-react'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { ModalCambioDisco } from '../features/operations/components/ModalCambioDisco'
import { ModalPendientesReperfilado } from '../features/operations/components/ModalPendientesReperfilado'
import { ModalRetiroMasivo } from '../features/operations/components/ModalRetiroMasivo'
import { useStatsInventario } from '../features/inventory/queries'

type TipoTren = 'ALSTOM' | 'ANSALDO'

function leerPreseleccion(params: URLSearchParams): { tren: number; coche: number } | null {
  const tren = Number(params.get('tren'))
  const coche = Number(params.get('coche'))
  return Number.isFinite(tren) && Number.isFinite(coche) && params.has('tren') && params.has('coche')
    ? { tren, coche }
    : null
}

export function Operaciones() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [preseleccion, setPreseleccion] = useState(() => leerPreseleccion(searchParams))
  const [tipoTren, setTipoTren] = useState<TipoTren>('ALSTOM')
  const [retiroAbierto, setRetiroAbierto] = useState(false)
  const [cambioAbierto, setCambioAbierto] = useState(() => preseleccion !== null)
  const [reperfiladoAbierto, setReperfiladoAbierto] = useState(false)
  const stats = useStatsInventario()

  useEffect(() => {
    if (searchParams.has('tren') || searchParams.has('coche')) {
      const next = new URLSearchParams(searchParams)
      next.delete('tren')
      next.delete('coche')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative mb-6 min-h-[clamp(235px,20vw,340px)] overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_24px_60px_rgba(6,78,59,0.22)]">
        <img src="/images/wallpapercentrooperaciones.png" alt="Centro de operaciones con trenes de Línea 1" className="absolute inset-0 h-full w-full object-cover object-[72%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#031812]/95 via-[#063b2b]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <div className="relative flex min-h-[clamp(235px,20vw,340px)] max-w-2xl flex-col justify-end p-6 sm:p-8">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-emerald-100 backdrop-blur-md">
            <ShieldCheck size={14} /> Centro de control EVA
          </span>
          <h1 className="font-display text-4xl font-bold tracking-tight !text-white sm:text-5xl">Operaciones</h1>
          <p className="mt-2 max-w-xl font-body text-sm leading-6 text-white/80 sm:text-base">Gestiona el movimiento y reemplazo de discos de freno con trazabilidad completa por tren, coche, bogie y eje.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Inventario conectado', 'Trazabilidad por eje', 'Validación técnica'].map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur"><CheckCircle2 size={13} className="text-emerald-300" />{item}</span>)}
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/55 px-4 py-3 shadow-sm backdrop-blur">
        <div><p className="font-display text-sm font-bold text-slate-800">Selecciona la flota</p><p className="text-xs text-slate-500">Las operaciones se adaptan al fabricante</p></div>
        <SegmentedControl
          ariaLabel="Tipo de tren"
          opciones={[
            {
              valor: 'ANSALDO',
              etiqueta: 'Ansaldo',
              deshabilitada: true,
              tooltip: 'Próximamente — la flota Ansaldo (trenes 1-5) todavía no tiene catálogo sembrado.',
            },
            { valor: 'ALSTOM', etiqueta: 'Alstom' },
          ]}
          valor={tipoTren}
          onCambiar={(v) => setTipoTren(v)}
        />
      </div>

      <div className="mb-7 overflow-hidden rounded-3xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-5 shadow-[0_14px_35px_rgba(14,116,144,0.10)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Boxes size={23} /></span>
            <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-700">Disponibilidad operativa</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stats.data?.taller ?? '—'} pares preparados en Taller</p><p className="text-xs text-slate-500">Listos para asignar en una operación de cambio de disco.</p></div>
          </div>
          <Link to="/inventario" className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">Ver inventario completo <ArrowRight size={15} /></Link>
        </div>
      </div>

      <div className="mb-4"><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-emerald-700">Flujo de trabajo</p><h2 className="mt-1 font-display text-2xl font-bold text-slate-900">Operaciones disponibles</h2><p className="mt-1 text-sm text-slate-500">Selecciona una acción para comenzar el proceso guiado.</p></div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => setRetiroAbierto(true)} className="group block text-left">
          <GlassSurface fuerte elevar className="h-full rounded-[2rem] border-amber-200/70 bg-gradient-to-br from-white to-amber-50/70 p-6 transition-all group-hover:border-amber-300 group-hover:shadow-[0_20px_50px_rgba(217,119,6,0.16)]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/20">
                <PackageMinus size={20} aria-hidden />
              </span>
              <ArrowRight size={20} aria-hidden className="text-amber-600 transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Retiro masivo</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Selecciona piezas en Almacén y pásalas a Taller para preparar un cambio.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 font-body text-xs font-bold text-white shadow-md shadow-orange-500/15">
              Iniciar retiro →
            </span>
          </GlassSurface>
        </button>

        <button type="button" onClick={() => setCambioAbierto(true)} className="group block text-left">
          <GlassSurface fuerte elevar className="h-full rounded-[2rem] border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/70 p-6 transition-all group-hover:border-emerald-300 group-hover:shadow-[0_20px_50px_rgba(5,150,105,0.16)]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-600/20">
                <Disc3 size={22} aria-hidden />
              </span>
              <ArrowRight size={20} aria-hidden className="text-emerald-600 transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Cambio de disco</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Reemplaza de 1 a 4 ejes de un coche con piezas ya preparadas en Taller.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 px-4 py-2 font-body text-xs font-bold text-white shadow-md shadow-emerald-600/15">
              Iniciar cambio →
            </span>
          </GlassSurface>
        </button>

        <button type="button" onClick={() => setReperfiladoAbierto(true)} className="group block text-left">
          <GlassSurface fuerte elevar className="h-full rounded-[2rem] border-violet-200/70 bg-gradient-to-br from-white to-violet-50/70 p-6 transition-all group-hover:border-violet-300 group-hover:shadow-[0_20px_50px_rgba(124,58,237,0.16)]">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-700 text-white shadow-lg shadow-violet-600/20">
                <ScanLine size={20} aria-hidden />
              </span>
              <ArrowRight size={20} aria-hidden className="text-violet-600 transition-transform group-hover:translate-x-1" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Reperfilado</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Trenes con discos pendientes de reperfilado según su última medición confirmada.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-violet-700 px-4 py-2 font-body text-xs font-bold text-white shadow-md shadow-violet-600/15">
              Ver pendientes →
            </span>
          </GlassSurface>
        </button>
      </div>

      {retiroAbierto && <ModalRetiroMasivo onCerrar={() => setRetiroAbierto(false)} />}
      {reperfiladoAbierto && <ModalPendientesReperfilado onCerrar={() => setReperfiladoAbierto(false)} />}
      {cambioAbierto && (
        <ModalCambioDisco
          trenInicial={preseleccion?.tren}
          cocheInicial={preseleccion?.coche}
          onCerrar={() => {
            setCambioAbierto(false)
            setPreseleccion(null)
          }}
        />
      )}
    </div>
  )
}
