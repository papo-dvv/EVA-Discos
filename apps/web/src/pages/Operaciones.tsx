import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, PackageMinus, RefreshCcw, ScanLine } from 'lucide-react'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { ModalCambioDisco } from '../features/operations/components/ModalCambioDisco'
import { ModalPendientesReperfilado } from '../features/operations/components/ModalPendientesReperfilado'
import { ModalRetiroMasivo } from '../features/operations/components/ModalRetiroMasivo'
import { useStatsInventario } from '../features/inventory/queries'

type TipoTren = 'ALSTOM' | 'ANSALDO'

export function Operaciones() {
  const [tipoTren, setTipoTren] = useState<TipoTren>('ALSTOM')
  const [retiroAbierto, setRetiroAbierto] = useState(false)
  const [cambioAbierto, setCambioAbierto] = useState(false)
  const [reperfiladoAbierto, setReperfiladoAbierto] = useState(false)
  const [preseleccion, setPreseleccion] = useState<{ tren: number; coche: number } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const stats = useStatsInventario()

  useEffect(() => {
    const trenStr = searchParams.get('tren')
    const cocheStr = searchParams.get('coche')
    if (trenStr && cocheStr) {
      const tren = Number(trenStr)
      const coche = Number(cocheStr)
      if (!Number.isNaN(tren) && !Number.isNaN(coche)) {
        setPreseleccion({ tren, coche })
        setCambioAbierto(true)
      }
      const next = new URLSearchParams(searchParams)
      next.delete('tren')
      next.delete('coche')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <GlassSurface
        fuerte
        className="mb-6 flex min-h-[clamp(220px,15vw,420px)] flex-col justify-end overflow-hidden rounded-glass-lg bg-cover bg-center px-6 py-8"
        style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url('/images/wallpapercentrooperaciones.png')" }}
      >
        <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-white/80">EVA</p>
        <h1 className="font-display text-3xl font-semibold text-white">Operaciones</h1>
        <p className="mt-1 max-w-xl font-body text-sm text-white/85">
          Retiro masivo de piezas desde Almacén y cambio de disco en tren.
        </p>
      </GlassSurface>

      <div className="mb-6 flex items-center gap-3">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Flota</p>
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GlassSurface className="rounded-glass px-4 py-3">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">
            Discos sueltos en Taller
          </p>
          <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">{stats.data?.taller ?? '—'}</p>
        </GlassSurface>
        <GlassSurface className="rounded-glass px-4 py-3">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">
            Discos en Almacén
          </p>
          <p className="mt-1 font-data text-2xl font-semibold text-concreto-oscuro">{stats.data?.almacen ?? '—'}</p>
        </GlassSurface>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-concreto-oscuro">Operaciones disponibles</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => setRetiroAbierto(true)} className="block text-left">
          <GlassSurface fuerte elevar className="rounded-glass-lg p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
                <PackageMinus size={20} aria-hidden />
              </span>
              <ArrowRight size={18} aria-hidden className="text-concreto" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Retiro masivo</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Selecciona piezas en Almacén y pásalas a Taller para preparar un cambio.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-verde-institucional to-verde-institucional/70 px-3 py-1 font-body text-xs font-semibold text-white">
              Iniciar retiro →
            </span>
          </GlassSurface>
        </button>

        <button type="button" onClick={() => setCambioAbierto(true)} className="block text-left">
          <GlassSurface fuerte elevar className="rounded-glass-lg p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
                <RefreshCcw size={20} aria-hidden />
              </span>
              <ArrowRight size={18} aria-hidden className="text-concreto" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Cambio de disco</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Reemplaza de 1 a 4 ejes de un coche con piezas ya preparadas en Taller.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-verde-institucional to-verde-institucional/70 px-3 py-1 font-body text-xs font-semibold text-white">
              Iniciar cambio →
            </span>
          </GlassSurface>
        </button>

        <button type="button" onClick={() => setReperfiladoAbierto(true)} className="block text-left">
          <GlassSurface fuerte elevar className="rounded-glass-lg p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
                <ScanLine size={20} aria-hidden />
              </span>
              <ArrowRight size={18} aria-hidden className="text-concreto" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Reperfilado</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Trenes con discos pendientes de reperfilado según su última medición confirmada.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-verde-institucional to-verde-institucional/70 px-3 py-1 font-body text-xs font-semibold text-white">
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
