import { useRef, useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSelect } from '../../../components/GlassSelect'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { FirmaDigital } from '../../new-measurement/components/FirmaDigital'
import { useInventario } from '../../inventory/queries'
import { BogieEjeVisual } from './BogieEjeVisual'
import { useCambioDisco, useDetalleTrenOperaciones } from '../queries'

const TRENES_ALSTOM = Array.from({ length: 39 }, (_, i) => i + 6)

type SlotAsignado = {
  bogieCodigo: string
  ejeNumero: number
  discoIzqId: string
  discoDerId: string
}

function claveSlot(bogieCodigo: string, ejeNumero: number): string {
  return `${bogieCodigo}:${ejeNumero}`
}

type Props = {
  onCerrar: () => void
  trenInicial?: number
  cocheInicial?: number
}

export function ModalCambioDisco({ onCerrar, trenInicial, cocheInicial }: Props) {
  const [trenNumero, setTrenNumero] = useState<number | undefined>(trenInicial)
  const [numeroCoche, setNumeroCoche] = useState<number | undefined>(cocheInicial)
  const [slots, setSlots] = useState<Record<string, SlotAsignado | null>>({})
  const [slotResaltado, setSlotResaltado] = useState<string | null>(null)
  const [tecnicoNombre, setTecnicoNombre] = useState('')
  const [supervisorNombre, setSupervisorNombre] = useState('')
  const [numeroPt, setNumeroPt] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [firma, setFirma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const resaltadoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const detalle = useDetalleTrenOperaciones(trenNumero)
  const enTaller = useInventario({ page: 1, pageSize: 200, stage: ['taller'] })
  const cambio = useCambioDisco()

  const coche = detalle.data?.coches.find((c) => c.numeroCoche === numeroCoche)

  // Taller lista EJES (par izq+der que comparten serie, ver InventoryRow) —
  // se elige el par completo de reemplazo de una vez.
  const ejesTallerCompletos = (enTaller.data?.rows ?? []).filter(
    (eje) => eje.izquierdo && eje.derecho,
  )

  const asignaciones = Object.values(slots).filter((s): s is SlotAsignado => s !== null)
  const asignados = new Set(asignaciones.map((s) => claveSlot(s.bogieCodigo, s.ejeNumero)))

  function limpiarSlots() {
    setSlots({})
    setSlotResaltado(null)
  }

  function resaltarSlot(key: string) {
    setSlotResaltado(key)
    document.getElementById(`slot-select-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (resaltadoTimeout.current) clearTimeout(resaltadoTimeout.current)
    resaltadoTimeout.current = setTimeout(() => setSlotResaltado(null), 1500)
  }

  function elegirParaSlot(bogieCodigo: string, ejeNumero: number, discoIzqIdElegido: string | undefined) {
    const key = claveSlot(bogieCodigo, ejeNumero)
    if (!discoIzqIdElegido) {
      setSlots((prev) => ({ ...prev, [key]: null }))
      return
    }
    const eje = ejesTallerCompletos.find((e) => e.izquierdo!.discoId === discoIzqIdElegido)
    if (!eje) return
    setSlots((prev) => ({
      ...prev,
      [key]: { bogieCodigo, ejeNumero, discoIzqId: eje.izquierdo!.discoId, discoDerId: eje.derecho!.discoId },
    }))
  }

  async function confirmar() {
    if (!numeroCoche || asignaciones.length === 0) return
    setError(null)
    try {
      await cambio.mutateAsync({
        numeroCoche,
        asignaciones: asignaciones.map((s) => ({
          bogieCodigo: s.bogieCodigo,
          ejeNumero: s.ejeNumero,
          discoNuevoIzquierdoId: s.discoIzqId,
          discoNuevoDerechoId: s.discoDerId,
        })),
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

  const puedeConfirmar = asignaciones.length > 0 && tecnicoNombre.trim().length > 0

  return (
    <GlassModal
      titulo="Cambio de disco"
      onCerrar={onCerrar}
      ancho={1080}
      altoMaximo="90vh"
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
            Instalar en coche
          </GlassButton>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-3 gap-3">
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Discos disponibles</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{ejesTallerCompletos.length}</p>
            <p className="font-body text-[0.65rem] text-concreto">({ejesTallerCompletos.length * 2} discos)</p>
          </div>
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Discos a instalar</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{asignaciones.length}</p>
            <p className="font-body text-[0.65rem] text-concreto">({asignaciones.length}/4 ejes · máx. 2 por bogie)</p>
          </div>
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Total ruedas</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{asignaciones.length * 4}</p>
            <p className="font-body text-[0.65rem] text-concreto">({asignaciones.length} baja + {asignaciones.length} alta)</p>
          </div>
        </div>

        <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
        <div className="space-y-4 pr-1">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-concreto/10 bg-white/30 p-4">
            <p className="mb-3 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
              Vista previa del coche
            </p>
            {!coche && (
              <p className="py-8 text-center font-body text-sm text-concreto">
                Elegí un tren y un coche para ver sus ejes.
              </p>
            )}
            {coche && (
              <BogieEjeVisual
                coche={coche}
                asignados={asignados}
                onClickEje={(bogieCodigo, ejeNumero) => resaltarSlot(claveSlot(bogieCodigo, ejeNumero))}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-concreto/10 bg-white/45 p-3">
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Configuración</p>
              <div className="space-y-3">
                <GlassSelect
                  label="Tren"
                  opciones={TRENES_ALSTOM.map((n) => ({ valor: String(n), etiqueta: `Tren ${n}` }))}
                  seleccion={trenNumero !== undefined ? String(trenNumero) : undefined}
                  onCambiar={(v) => {
                    setTrenNumero(v ? Number(v) : undefined)
                    setNumeroCoche(undefined)
                    limpiarSlots()
                  }}
                />
                <GlassSelect
                  label="Coche"
                  disabled={!detalle.data}
                  opciones={(detalle.data?.coches ?? [])
                    .filter((c) => c.numeroCoche !== null)
                    .map((c) => ({ valor: String(c.numeroCoche), etiqueta: `Coche ${c.numeroCoche} (${c.coche})` }))}
                  seleccion={numeroCoche !== undefined ? String(numeroCoche) : undefined}
                  onCambiar={(v) => {
                    setNumeroCoche(v ? Number(v) : undefined)
                    limpiarSlots()
                  }}
                />
              </div>
            </div>

            {coche && (
              <div className="rounded-2xl border border-concreto/10 bg-white/45 p-3">
                <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                  Seleccionar discos
                </p>
                <div className="space-y-3">
                  {coche.bogies.flatMap((bogie) =>
                    bogie.ejes.map((ejeFila) => {
                      const key = claveSlot(bogie.bogie, ejeFila.eje)
                      const slotsElegidosEnOtro = asignaciones
                        .filter((s) => claveSlot(s.bogieCodigo, s.ejeNumero) !== key)
                        .map((s) => s.discoIzqId)
                      const opciones = ejesTallerCompletos
                        .filter((eje) => !slotsElegidosEnOtro.includes(eje.izquierdo!.discoId))
                        .map((eje) => ({
                          valor: eje.izquierdo!.discoId,
                          etiqueta: `${eje.serie ? `${eje.serie}-D` : '(sin serie)'}${eje.marcaRueda ? ` · ${eje.marcaRueda}` : ''}`,
                        }))
                      return (
                        <div
                          key={key}
                          id={`slot-select-${key}`}
                          className={`rounded-2xl transition-shadow ${slotResaltado === key ? 'ring-2 ring-verde-institucional' : ''}`}
                        >
                          <GlassSelect
                            label={`Bogie ${bogie.bogie} · Eje ${ejeFila.eje}`}
                            placeholder="Sin cambio"
                            opciones={opciones}
                            seleccion={slots[key]?.discoIzqId}
                            onCambiar={(v) => elegirParaSlot(bogie.bogie, ejeFila.eje, v)}
                          />
                        </div>
                      )
                    }),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-concreto/15 pt-4">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Datos de operación</p>
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
              <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Firma</p>
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

        {error && (
          <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
            ⚠ {error}
          </p>
        )}
        </div>
        </ScrollArea>
      </div>
    </GlassModal>
  )
}
