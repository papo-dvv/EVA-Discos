import { Activity, ArrowLeft, CircleCheck, TriangleAlert, TrainFront } from 'lucide-react'
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
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/fleet" className="glass-chip inline-flex items-center gap-2 text-concreto-oscuro">
          <ArrowLeft size={15} aria-hidden />
          Flota
        </Link>
      </div>

      <GlassSurface fuerte className="mb-6 rounded-glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">Detalle de tren</p>
            <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-semibold text-concreto-oscuro">
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
          <ResumenOperativo detalle={detalle.data} />
          {detalle.data.coches.map((coche) => (
            <section key={coche.coche} className="space-y-3">
              <div className="flex items-center justify-between border-b border-concreto/15 pb-2">
                <h2 className="font-display text-xl font-semibold text-concreto-oscuro">
                  {coche.coche} · {coche.numeroCoche ?? 'Sin N°'}
                </h2>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
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

function ResumenOperativo({ detalle }: { detalle: NonNullable<ReturnType<typeof useFleetDetalle>['data']> }) {
  const discos = detalle.coches.flatMap((coche) => coche.bogies.flatMap((bogie) => bogie.ejes.flatMap((eje) => eje.discos)))
  const evaluados = discos.filter((disco) => disco.estadoCalculado !== null)
  const atencion = evaluados.filter((disco) => ['SEGUIMIENTO', 'CAMBIO', 'REPERFILADO'].includes(disco.estadoCalculado ?? '')).length
  const criticos = evaluados.filter((disco) => disco.estadoCalculado === 'CRITICO').length
  const ok = evaluados.filter((disco) => disco.estadoCalculado === 'OK').length
  const tarjetas = [
    { etiqueta: 'Discos evaluados', valor: evaluados.length, detalle: `${discos.length - evaluados.length} sin dato`, icono: Activity, clase: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white text-sky-800' },
    { etiqueta: 'Operación estable', valor: ok, detalle: 'estado OK', icono: CircleCheck, clase: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-800' },
    { etiqueta: 'Requieren atención', valor: atencion, detalle: 'seguimiento, cambio o reperfilado', icono: TriangleAlert, clase: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-800' },
    { etiqueta: 'Críticos', valor: criticos, detalle: criticos ? 'priorizar intervención' : 'sin alertas críticas', icono: TriangleAlert, clase: criticos ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-800' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-700' },
  ]
  return (
    <section aria-label="Resumen operativo del tren" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tarjetas.map((tarjeta) => {
        const Icono = tarjeta.icono
        return <div key={tarjeta.etiqueta} className={`rounded-2xl border p-4 shadow-sm ${tarjeta.clase}`}><div className="flex items-start justify-between gap-3"><div><p className="font-body text-[0.65rem] font-bold uppercase tracking-[0.13em] opacity-70">{tarjeta.etiqueta}</p><p className="mt-1 font-data text-3xl font-bold">{tarjeta.valor}</p></div><span className="rounded-xl bg-white/75 p-2 shadow-sm"><Icono size={18} /></span></div><p className="mt-1 font-body text-[0.68rem] opacity-75">{tarjeta.detalle}</p></div>
      })}
    </section>
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
