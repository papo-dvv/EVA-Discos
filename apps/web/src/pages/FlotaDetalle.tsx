import { ArrowLeft, Train } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GlassSurface } from '../components/GlassSurface'
import { ScrollArea } from '../components/ScrollArea'
import { BogieVisualizer } from '../features/fleet/components/BogieVisualizer'
import { ESTADO_META } from '../features/fleet/components/estadoVisual'
import { FABRICANTE_CLASES, fabricanteDeTren } from '../features/fleet/components/fabricante'
import { LeyendaRangosDiscos } from '../features/fleet/components/LeyendaRangosDiscos'
import { ModalHistoricoDisco } from '../features/fleet/components/ModalHistoricoDisco'
import { getEstadoDominanteTren, ICONO_ESTADO_TREN } from '../features/fleet/components/semaforoTren'
import { useFleetDetalle } from '../features/fleet/queries'
import type { EstadoTren, FleetDiscoDetalle } from '../features/fleet/types'
import { aFechaCorta } from '../features/new-measurement/fecha'
import type { EstadoDisco } from '../features/scan-records/types'

const ESTADO_TREN_LABEL: Record<EstadoTren, string> = {
  operativo: 'Activo',
  mantenimiento: 'En mantenimiento',
  baja: 'De baja',
}

function formatoKm(km: number | null): string {
  return km === null ? '—' : `${new Intl.NumberFormat('es-PE').format(Math.round(km))} km`
}

function formatoFecha(iso: string | null): string {
  return iso ? aFechaCorta(iso) : '—'
}

export function FlotaDetalle() {
  const params = useParams()
  const tren = Number(params.tren)
  const detalle = useFleetDetalle(tren)
  const [discoSeleccionado, setDiscoSeleccionado] = useState<FleetDiscoDetalle | null>(null)

  if (!Number.isInteger(tren)) return <Navigate to="/fleet" replace />

  // cardcochealstom{1-6}.png / cardcocheab{1-6}.png — mismo criterio de par
  // por fabricante que ya usa Flota.tsx con mediciones-tren-alerta-*.png.
  const fabricante = fabricanteDeTren(tren)
  const prefijoImagenCoche = fabricante === 'ALSTOM' ? 'cardcochealstom' : 'cardcocheab'

  return (
    <div className="mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/fleet"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <ArrowLeft size={15} aria-hidden />
          Flota
        </Link>
      </div>

      {detalle.isLoading && <p className="py-12 text-center font-body text-sm text-concreto">Cargando detalle...</p>}
      {detalle.isError && (
        <p role="alert" className="py-12 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar el detalle del tren.
        </p>
      )}

      {detalle.data && (
        <>
          <GlassSurface fuerte className="mb-4 rounded-glass p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-arena-suave p-2 text-concreto-oscuro">
                <Train size={24} aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-slate-800">Tren {tren}</h1>
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${FABRICANTE_CLASES[fabricante]}`}
                  >
                    {fabricante === 'ALSTOM' ? 'Alstom' : 'Ansaldo'}
                  </span>
                  {(() => {
                    const estadoDominante = getEstadoDominanteTren(detalle.data.conteoEstado)
                    const meta = ESTADO_META[estadoDominante]
                    const Icono = ICONO_ESTADO_TREN[estadoDominante]
                    return (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: `color-mix(in srgb, ${meta.cssVar} 16%, transparent)`, color: meta.cssVar }}
                      >
                        <Icono size={13} aria-hidden />
                        {meta.etiqueta.toUpperCase()}
                      </span>
                    )
                  })()}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Selecciona un disco para consultar sus mediciones e historial.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
              <DataPair label="Estado operacional" value={ESTADO_TREN_LABEL[detalle.data.estado]} />
              <DataPair label="Kilometraje total" value={formatoKm(detalle.data.kilometrajeActual)} />
              <DataPair label="Última medición" value={formatoFecha(detalle.data.fechaUltimaMedicion)} />
              {/* El modelo Train de EVA no tiene un campo de fecha de fabricación
                  (solo createdAt, que es la fecha del registro en BD, no del tren
                  físico) — se muestra fijo en "—" hasta que exista ese dato. */}
              <DataPair label="Fecha fabricación" value="—" />
            </div>
          </GlassSurface>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO'] satisfies EstadoDisco[]).map((estado) => (
              <GlassSurface key={estado} className="rounded-glass px-4 py-3">
                <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-concreto">
                  {ESTADO_META[estado].etiqueta}
                </p>
                <p className="mt-1 font-display text-3xl font-bold" style={{ color: ESTADO_META[estado].cssVar }}>
                  {detalle.data.conteoEstado?.[estado.toLowerCase() as keyof typeof detalle.data.conteoEstado] ?? 0}
                </p>
              </GlassSurface>
            ))}
          </div>
        </>
      )}

      {detalle.data && (
        <ScrollArea ejes="x" viewportClassName="pb-3">
          <div className="flex min-w-max items-start gap-4">
            {detalle.data.coches.map((coche, indice) => (
              <GlassSurface fuerte key={coche.coche} className="w-[504px] shrink-0 overflow-hidden rounded-glass p-0">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-white to-emerald-50/40 px-4 py-3">
                  <img
                    src={`/images/${prefijoImagenCoche}${Math.min(indice + 1, 6)}.png`}
                    alt={`Coche ${coche.coche}`}
                    className="h-12 w-16 shrink-0 object-contain drop-shadow-sm"
                  />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-700">
                      Coche {indice + 1} de {detalle.data.coches.length}
                    </p>
                    <h2 className="mt-0.5 truncate font-display text-base font-bold text-slate-800">
                      {coche.coche} · {coche.numeroCoche ?? 'Sin N°'}
                    </h2>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  {coche.bogies.map((bogie, idx) => (
                    <div key={`${coche.coche}-${bogie.bogie}`}>
                      <BogieVisualizer
                        bogie={bogie}
                        onSeleccionarDisco={setDiscoSeleccionado}
                        posicion={idx + 1}
                        total={coche.bogies.length}
                      />
                      {idx < coche.bogies.length - 1 && <div className="mt-4 border-t-2 border-slate-200" aria-hidden />}
                    </div>
                  ))}
                </div>
              </GlassSurface>
            ))}
          </div>
        </ScrollArea>
      )}

      {detalle.data && (
        <div className="mt-6">
          <LeyendaRangosDiscos />
        </div>
      )}

      {discoSeleccionado && <ModalHistoricoDisco disco={discoSeleccionado} onCerrar={() => setDiscoSeleccionado(null)} />}
    </div>
  )
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-concreto">{label}</p>
      <p className="mt-0.5 font-body text-base font-semibold text-slate-800">{value}</p>
    </div>
  )
}
