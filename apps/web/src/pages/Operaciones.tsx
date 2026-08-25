import { useState } from 'react'
import { ArrowRight, PackageMinus, RefreshCcw } from 'lucide-react'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { ModalCambioDisco } from '../features/operations/components/ModalCambioDisco'
import { ModalRetiroMasivo } from '../features/operations/components/ModalRetiroMasivo'

type TipoTren = 'ALSTOM' | 'ANSALDO'

export function Operaciones() {
  const [tipoTren, setTipoTren] = useState<TipoTren>('ALSTOM')
  const [retiroAbierto, setRetiroAbierto] = useState(false)
  const [cambioAbierto, setCambioAbierto] = useState(false)

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <GlassSurface
        fuerte
        className="mb-6 overflow-hidden rounded-glass-lg bg-cover bg-center px-6 py-8"
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
          onCambiar={setTipoTren}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setRetiroAbierto(true)} className="block text-left">
          <GlassSurface fuerte elevar className="rounded-glass-lg p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-concreto/15 bg-white/45 text-concreto-oscuro">
                <PackageMinus size={20} aria-hidden />
              </span>
              <ArrowRight size={18} aria-hidden className="text-concreto" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Retiro masivo</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Selecciona piezas en Almacén y pásalas a Taller para preparar un cambio.
            </p>
          </GlassSurface>
        </button>

        <button type="button" onClick={() => setCambioAbierto(true)} className="block text-left">
          <GlassSurface fuerte elevar className="rounded-glass-lg p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-concreto/15 bg-white/45 text-concreto-oscuro">
                <RefreshCcw size={20} aria-hidden />
              </span>
              <ArrowRight size={18} aria-hidden className="text-concreto" />
            </div>
            <p className="mt-4 font-display text-xl font-semibold text-concreto-oscuro">Cambio de disco</p>
            <p className="mt-1 font-body text-sm text-concreto">
              Reemplaza ambos lados de un eje con piezas ya preparadas en Taller.
            </p>
          </GlassSurface>
        </button>
      </div>

      {retiroAbierto && <ModalRetiroMasivo onCerrar={() => setRetiroAbierto(false)} />}
      {cambioAbierto && <ModalCambioDisco onCerrar={() => setCambioAbierto(false)} />}
    </div>
  )
}
