import { Check, Circle, ClipboardCheck, Disc3, PackageCheck, TrainFront, UserRound } from 'lucide-react'
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
  const pasos = [Boolean(trenNumero && numeroCoche), asignaciones.length > 0, tecnicoNombre.trim().length > 0]

  return (
    <GlassModal
      titulo={
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-lg shadow-emerald-600/25"><Disc3 size={23} /></span>
          <span><span className="block text-lg">Cambio de disco</span><span className="block font-body text-xs font-normal text-slate-500">Instalación guiada con trazabilidad por eje</span></span>
        </div>
      }
      onCerrar={onCerrar}
      ancho={1080}
      altoMaximo="90vh"
      footer={
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-500">{puedeConfirmar ? <Check size={16} className="rounded-full bg-emerald-600 p-0.5 text-white" /> : <Circle size={15} />}{puedeConfirmar ? 'Operación lista para confirmar' : 'Completa ubicación, repuestos y técnico'}</p>
          <div className="flex justify-end gap-2">
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
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-white to-cyan-50/70 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Progreso de instalación</p><p className="mt-0.5 text-xs text-slate-500">Completa los tres pasos para habilitar la operación</p></div><span className="rounded-full bg-white px-3 py-1 font-data text-xs font-bold text-emerald-700 shadow-sm">{pasos.filter(Boolean).length}/3</span></div>
          <div className="grid grid-cols-3 gap-2">{['Ubicación', 'Repuestos', 'Responsable'].map((paso, i) => <div key={paso}><div className={`mb-1.5 h-1.5 rounded-full ${pasos[i] ? 'bg-emerald-500' : 'bg-slate-200'}`} /><p className={`text-[0.64rem] font-semibold ${pasos[i] ? 'text-emerald-700' : 'text-slate-400'}`}>{i + 1}. {paso}</p></div>)}</div>
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-3 shadow-sm">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Discos disponibles</p>
            <p className="mt-1 font-data text-2xl font-bold text-sky-800">{ejesTallerCompletos.length}</p>
            <p className="font-body text-[0.65rem] text-concreto">({ejesTallerCompletos.length * 2} discos)</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 shadow-sm">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Discos a instalar</p>
            <p className="mt-1 font-data text-2xl font-bold text-emerald-800">{asignaciones.length}</p>
            <p className="font-body text-[0.65rem] text-concreto">({asignaciones.length}/4 ejes · máx. 2 por bogie)</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-4 py-3 shadow-sm">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Total ruedas</p>
            <p className="mt-1 font-data text-2xl font-bold text-violet-800">{asignaciones.length * 4}</p>
            <p className="font-body text-[0.65rem] text-concreto">({asignaciones.length} baja + {asignaciones.length} alta)</p>
          </div>
        </div>

        <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
        <div className="space-y-4 pr-1">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white/80 to-slate-50/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><TrainFront size={18} className="text-emerald-600" /><div><p className="text-sm font-bold text-slate-800">Vista 3D del coche</p><p className="text-xs text-slate-500">Pulsa un eje para ubicar su selector</p></div></div>
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
            <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/75 to-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><TrainFront size={17} className="text-emerald-600" /><div><p className="text-sm font-bold text-slate-800">1. Ubicación</p><p className="text-xs text-slate-500">Tren y coche intervenido</p></div></div>
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
              <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2"><PackageCheck size={17} className="text-amber-600" /><div><p className="text-sm font-bold text-slate-800">2. Asignar repuestos</p><p className="text-xs text-slate-500">Selecciona el par preparado por eje</p></div></div>
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

        <div className="space-y-3 rounded-3xl border border-sky-200/80 bg-gradient-to-br from-sky-50/75 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><UserRound size={18} className="text-sky-600" /><div><p className="text-sm font-bold text-slate-800">3. Responsable y trazabilidad</p><p className="text-xs text-slate-500">Registra ejecución, autorización y motivo</p></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              placeholder="Describe el motivo del cambio y cualquier hallazgo relevante…"
              rows={3}
              className="glass-field w-full px-3 py-2 text-sm"
            />
          </div>
          {numeroCoche && asignaciones.length > 0 && <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3"><ClipboardCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" /><p className="text-xs leading-5 text-emerald-900"><strong>Resumen:</strong> Tren {trenNumero}, coche {numeroCoche}. Se reemplazarán {asignaciones.length} eje(s), equivalentes a {asignaciones.length * 2} discos.</p></div>}
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
