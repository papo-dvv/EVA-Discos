import { ArrowRight, TrainFront } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GlassSurface } from '../components/GlassSurface'
import { BadgeEstadoFlota } from '../features/fleet/components/BadgeEstadoFlota'
import { useFleetSummary } from '../features/fleet/queries'

export function Flota() {
  const summary = useFleetSummary()

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-concreto">EVA</p>
          <h1 className="font-display text-3xl font-semibold text-concreto-oscuro">Flota</h1>
        </div>
        <p className="max-w-xl font-body text-sm text-concreto">Trenes ALSTOM 6 a 44, con última medición confirmada y alertas actuales por disco.</p>
      </div>

      {summary.isLoading && <p className="py-12 text-center font-body text-sm text-concreto">Cargando flota...</p>}
      {summary.isError && (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar el resumen de flota.
        </p>
      )}

      {summary.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {summary.data.map((tren) => {
            const alertas = [
              { estado: 'CAMBIO' as const, conteo: tren.conteoAlerta.cambio },
              { estado: 'CRITICO' as const, conteo: tren.conteoAlerta.critico },
              { estado: 'REPERFILADO' as const, conteo: tren.conteoAlerta.reperfilado },
            ].filter((a) => a.conteo > 0)

            return (
              <Link key={tren.tren} to={`/fleet/${tren.tren}`} className="group block">
                <GlassSurface
                  fuerte
                  elevar
                  className="min-h-[13rem] rounded-glass p-5 transition-transform group-hover:-translate-y-0.5"
                >
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-concreto">Tren</p>
                        <p className="mt-1 font-display text-5xl font-semibold leading-none text-concreto-oscuro">{tren.tren}</p>
                      </div>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-concreto/15 bg-white/45 text-concreto-oscuro">
                        <TrainFront size={19} aria-hidden />
                      </span>
                    </div>

                    <div>
                      <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Última medición</p>
                      <p className="mt-1 font-data text-lg font-semibold text-concreto-oscuro">{tren.fechaUltimaMedicion ?? 'Sin datos'}</p>
                    </div>

                    <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {alertas.map((alerta) => (
                          <BadgeEstadoFlota key={alerta.estado} estado={alerta.estado} conteo={alerta.conteo} />
                        ))}
                      </div>
                      <ArrowRight size={17} aria-hidden className="shrink-0 text-concreto transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </GlassSurface>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
