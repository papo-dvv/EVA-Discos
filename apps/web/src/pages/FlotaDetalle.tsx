import { ArrowLeft, TrainFront } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GlassSurface } from '../components/GlassSurface'
import { BogieVisualizer } from '../features/fleet/components/BogieVisualizer'
import { ModalHistoricoDisco } from '../features/fleet/components/ModalHistoricoDisco'
import { useFleetDetalle } from '../features/fleet/queries'
import type { FleetDiscoDetalle } from '../features/fleet/types'

export function FlotaDetalle() {
  const params = useParams()
  const tren = Number(params.tren)
  const detalle = useFleetDetalle(tren)
  const [discoSeleccionado, setDiscoSeleccionado] = useState<FleetDiscoDetalle | null>(null)

  if (!Number.isInteger(tren)) return <Navigate to="/fleet" replace />

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/fleet" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700">
          <ArrowLeft size={15} aria-hidden />
          Flota
        </Link>
      </div>

      <GlassSurface fuerte className="mb-6 rounded-glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Vista técnica de la unidad</p>
            <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold text-slate-800">
              <TrainFront size={28} aria-hidden />
              Tren {tren}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Leyenda estado="OK" />
            <Leyenda estado="SEGUIMIENTO" />
            <Leyenda estado="CAMBIO" />
            <Leyenda estado="CRITICO" />
            <Leyenda estado="REPERFILADO" />
            <span className="glass-chip inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-concreto/40" />
              Sin datos
            </span>
          </div>
        </div>
      </GlassSurface>

      {detalle.isLoading && <p className="py-12 text-center font-body text-sm text-concreto">Cargando detalle...</p>}
      {detalle.isError && (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar el detalle del tren.
        </p>
      )}

      {detalle.data && (
        <div className="space-y-5">
          {detalle.data.coches.map((coche, indice) => (
            <section key={coche.coche} className="eva-panel overflow-hidden">
              <div className="grid min-h-40 border-b border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50/40 lg:grid-cols-[minmax(280px,0.8fr)_1.2fr]">
                <div className="relative flex items-center justify-center overflow-hidden p-4">
                  <div className="absolute h-28 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
                  <img src={`/images/cardcochealstom${Math.min(indice + 1, 6)}.png`} alt={`Coche ${coche.coche}`} className="relative max-h-32 w-full object-contain drop-shadow-xl" />
                </div>
                <div className="flex flex-col justify-center border-t border-slate-100 p-5 lg:border-l lg:border-t-0">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-700">Coche {indice + 1} de {detalle.data.coches.length}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-slate-800">{coche.coche} · {coche.numeroCoche ?? 'Sin N°'}</h2>
                  <p className="mt-2 text-sm text-slate-500">Selecciona un disco para consultar sus mediciones e historial.</p>
                </div>
              </div>
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                {coche.bogies.map((bogie) => (
                  <BogieVisualizer key={`${coche.coche}-${bogie.bogie}`} bogie={bogie} onSeleccionarDisco={setDiscoSeleccionado} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {discoSeleccionado && <ModalHistoricoDisco disco={discoSeleccionado} onCerrar={() => setDiscoSeleccionado(null)} />}
    </div>
  )
}

function Leyenda({ estado }: { estado: 'OK' | 'SEGUIMIENTO' | 'CAMBIO' | 'CRITICO' | 'REPERFILADO' }) {
  const cssVar = {
    OK: 'var(--color-estado-ok)',
    SEGUIMIENTO: 'var(--color-estado-seguimiento)',
    CAMBIO: 'var(--color-estado-cambio)',
    CRITICO: 'var(--color-estado-critico)',
    REPERFILADO: 'var(--color-estado-reperfilado)',
  }[estado]
  const etiqueta = {
    OK: 'OK',
    SEGUIMIENTO: 'Seguimiento',
    CAMBIO: 'Cambio',
    CRITICO: 'Crítico',
    REPERFILADO: 'Reperfilado',
  }[estado]

  return (
    <span className="glass-chip inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssVar }} />
      {etiqueta}
    </span>
  )
}
