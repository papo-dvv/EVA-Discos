import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSelect } from '../../../components/GlassSelect'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { FirmaDigital } from '../../new-measurement/components/FirmaDigital'
import { useInventario } from '../../inventory/queries'
import { useCambioDisco, useDetalleTrenOperaciones } from '../queries'

const TRENES_ALSTOM = Array.from({ length: 39 }, (_, i) => i + 6)

const CLASE_CHIP_ESTADO: Record<string, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

type EjeSeleccionado = {
  numeroCoche: number
  coche: string
  bogieCodigo: string
  ejeNumero: number
}

export function ModalCambioDisco({ onCerrar }: { onCerrar: () => void }) {
  const [trenNumero, setTrenNumero] = useState<number | undefined>(undefined)
  const [eje, setEje] = useState<EjeSeleccionado | null>(null)
  const [discoIzqId, setDiscoIzqId] = useState<string | undefined>(undefined)
  const [discoDerId, setDiscoDerId] = useState<string | undefined>(undefined)
  const [tecnicoNombre, setTecnicoNombre] = useState('')
  const [supervisorNombre, setSupervisorNombre] = useState('')
  const [numeroPt, setNumeroPt] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [firma, setFirma] = useState('')
  const [error, setError] = useState<string | null>(null)

  const detalle = useDetalleTrenOperaciones(trenNumero)
  const enTaller = useInventario({ page: 1, pageSize: 200, stage: ['taller'] })
  const cambio = useCambioDisco()

  const opcionesTaller = (enTaller.data?.rows ?? []).map((d) => ({
    valor: d.id,
    etiqueta: `${d.serie ?? '(sin serie)'}${d.marcaRueda ? ` · ${d.marcaRueda}` : ''}`,
  }))

  async function confirmar() {
    if (!eje || !discoIzqId || !discoDerId) return
    setError(null)
    try {
      await cambio.mutateAsync({
        numeroCoche: eje.numeroCoche,
        bogieCodigo: eje.bogieCodigo,
        ejeNumero: eje.ejeNumero,
        discoNuevoIzquierdoId: discoIzqId,
        discoNuevoDerechoId: discoDerId,
        tecnicoNombre: tecnicoNombre.trim(),
        supervisorNombre: supervisorNombre.trim() || undefined,
        numeroPt: numeroPt.trim() || undefined,
        justificacion: justificacion.trim() || undefined,
        firma: firma || undefined,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo completar el cambio de disco.'))
    }
  }

  const puedeConfirmar =
    Boolean(eje) &&
    Boolean(discoIzqId) &&
    Boolean(discoDerId) &&
    tecnicoNombre.trim().length > 0

  return (
    <GlassModal
      titulo="Cambio de disco"
      onCerrar={onCerrar}
      ancho={720}
      altoMaximo="88vh"
      footer={
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton
            type="button"
            cargando={cambio.isPending}
            disabled={!puedeConfirmar}
            onClick={confirmar}
          >
            Confirmar cambio
          </GlassButton>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <GlassSelect
          label="Tren"
          opciones={TRENES_ALSTOM.map((n) => ({ valor: String(n), etiqueta: `Tren ${n}` }))}
          seleccion={trenNumero !== undefined ? String(trenNumero) : undefined}
          onCambiar={(v) => {
            setTrenNumero(v ? Number(v) : undefined)
            setEje(null)
          }}
          className="shrink-0 max-w-xs"
        />

        {trenNumero !== undefined && (
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
              Elegí el eje que necesita cambio
            </p>
            <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
              <div className="space-y-1.5 pr-1">
                {detalle.isLoading && <p className="px-2 py-4 text-center text-sm text-concreto">Cargando…</p>}
                {detalle.data?.coches.map((coche) =>
                  coche.bogies.map((bogie) =>
                    bogie.ejes.map((ejeFila) => {
                      const activo =
                        eje?.numeroCoche === coche.numeroCoche &&
                        eje.bogieCodigo === bogie.bogie &&
                        eje.ejeNumero === ejeFila.eje
                      return (
                        <button
                          key={`${coche.coche}-${bogie.bogie}-${ejeFila.eje}`}
                          type="button"
                          onClick={() =>
                            coche.numeroCoche !== null &&
                            setEje({
                              numeroCoche: coche.numeroCoche,
                              coche: coche.coche,
                              bogieCodigo: bogie.bogie,
                              ejeNumero: ejeFila.eje,
                            })
                          }
                          disabled={coche.numeroCoche === null}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                            activo
                              ? 'border-verde-institucional bg-verde-institucional/10'
                              : 'border-concreto/10 bg-white/45 hover:bg-white/60'
                          }`}
                        >
                          <span className="font-semibold text-concreto-oscuro">
                            Coche {coche.numeroCoche} ({coche.coche}) · Bogie {bogie.bogie} · Eje {ejeFila.eje}
                          </span>
                          <span className="flex gap-1.5">
                            {ejeFila.discos.map((d) => (
                              <span
                                key={d.lado}
                                className={`tabla-chip ${d.estadoCalculado ? CLASE_CHIP_ESTADO[d.estadoCalculado] : ''}`}
                              >
                                {d.lado === 'izquierdo' ? 'Izq' : 'Der'}: {d.estadoCalculado ?? '—'}
                              </span>
                            ))}
                          </span>
                        </button>
                      )
                    }),
                  ),
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {eje && (
          <div className="shrink-0 space-y-3 border-t border-concreto/15 pt-4">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
              Piezas de reemplazo (Taller)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <GlassSelect
                label="Lado izquierdo *"
                opciones={opcionesTaller}
                seleccion={discoIzqId}
                onCambiar={setDiscoIzqId}
              />
              <GlassSelect
                label="Lado derecho *"
                opciones={opcionesTaller}
                seleccion={discoDerId}
                onCambiar={setDiscoDerId}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <GlassField
                label="Técnico *"
                value={tecnicoNombre}
                onChange={(e) => setTecnicoNombre(e.target.value)}
                placeholder="Nombre del técnico"
              />
              <GlassField
                label="Supervisor"
                value={supervisorNombre}
                onChange={(e) => setSupervisorNombre(e.target.value)}
                placeholder="Opcional"
              />
              <GlassField
                label="N° PT"
                value={numeroPt}
                onChange={(e) => setNumeroPt(e.target.value)}
                placeholder="Opcional"
              />
              <div>
                <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                  Firma
                </p>
                <FirmaDigital etiqueta="Técnico" valor={firma} onGuardar={setFirma} />
              </div>
            </div>
            <div>
              <label
                htmlFor="cambio-disco-justificacion"
                className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
              >
                Justificación
              </label>
              <textarea
                id="cambio-disco-justificacion"
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Opcional"
                rows={2}
                className="glass-field w-full px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="shrink-0 font-body text-sm text-[color:var(--color-estado-critico)]">
            ⚠ {error}
          </p>
        )}
      </div>
    </GlassModal>
  )
}
