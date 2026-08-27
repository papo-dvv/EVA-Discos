import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { FirmaDigital } from '../../new-measurement/components/FirmaDigital'
import { MedidasEjeSplit } from '../../inventory/components/MedidasEjeSplit'
import { vidaUtilPorcentaje } from '../../inventory/vidaUtil'
import { useInventario, useStatsInventario } from '../../inventory/queries'
import { ETIQUETA_FABRICANTE, type Fabricante } from '../../inventory/types'
import { useRetiroMasivo } from '../queries'

const OPCIONES_FLOTA = [
  { valor: 'alstom_metropolis9000' as Fabricante, etiqueta: 'Alstom' },
  { valor: 'ansaldo_mb300' as Fabricante, etiqueta: 'Ansaldo' },
]

export function ModalRetiroMasivo({ onCerrar }: { onCerrar: () => void }) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [flota, setFlota] = useState<Fabricante | undefined>(undefined)
  const [tecnicoNombre, setTecnicoNombre] = useState('')
  const [supervisorNombre, setSupervisorNombre] = useState('')
  const [numeroPt, setNumeroPt] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [firma, setFirma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const stats = useStatsInventario()
  const enAlmacen = useInventario({
    page: 1,
    pageSize: 200,
    stage: ['almacen'],
    fabricante: flota ? [flota] : undefined,
  })
  const retiro = useRetiroMasivo()

  // La selección es por EJE (par izquierdo+derecho, ver InventoryRow) — al
  // marcar una fila se agregan/quitan los 2 discoId juntos, nunca uno solo,
  // así el retiro masivo siempre mueve el par completo a Taller.
  function alternarPar(ids: string[]) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev)
      const yaSeleccionado = ids.every((id) => nuevo.has(id))
      for (const id of ids) {
        if (yaSeleccionado) nuevo.delete(id)
        else nuevo.add(id)
      }
      return nuevo
    })
  }

  function cambiarFlota(nueva: Fabricante | undefined) {
    setFlota(nueva)
    setSeleccion(new Set())
  }

  async function confirmar() {
    setError(null)
    try {
      await retiro.mutateAsync({
        discIds: [...seleccion],
        encargadoNombre: tecnicoNombre.trim(),
        encargadoFirma: firma || undefined,
        supervisorNombre: supervisorNombre.trim() || undefined,
        numeroPt: numeroPt.trim() || undefined,
        justificacion: observaciones.trim() || undefined,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo completar el retiro masivo.'))
    }
  }

  const puedeConfirmar = seleccion.size > 0 && tecnicoNombre.trim().length > 0

  return (
    <GlassModal
      titulo="Retiro masivo"
      onCerrar={onCerrar}
      ancho={860}
      altoMaximo="88vh"
      footer={
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="font-body text-xs text-concreto">{seleccion.size} disco(s) seleccionados</p>
          <div className="flex gap-2">
            <GlassButton type="button" variante="secundario" onClick={onCerrar}>
              Cancelar
            </GlassButton>
            <GlassButton
              type="button"
              cargando={retiro.isPending}
              disabled={!puedeConfirmar}
              onClick={confirmar}
            >
              Retirar ({seleccion.size}) ruedas a Taller
            </GlassButton>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-3 gap-3">
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Discos en Almacén</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{stats.data?.almacen ?? '—'}</p>
          </div>
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Seleccionadas</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{seleccion.size}</p>
          </div>
          <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
            <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">A mover a Taller</p>
            <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{seleccion.size}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Flota</p>
          <SegmentedControl
            ariaLabel="Filtrar por flota"
            opciones={OPCIONES_FLOTA}
            valor={flota}
            onCambiar={(v) => cambiarFlota(v)}
          />
        </div>

        <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
          <div className="w-full overflow-x-auto pr-1">
            <table className="w-full min-w-[42rem] table-fixed border-collapse font-body text-xs">
              <thead className="sticky top-0 z-10 bg-[color:var(--color-arena-suave)]">
                <tr className="border-b border-concreto/10">
                  <th className="w-8 px-2 py-2.5" />
                  <th className="px-3 py-2.5 text-left">Serie</th>
                  <th className="px-3 py-2.5 text-left">Medidas</th>
                  <th className="px-3 py-2.5 text-right">Vida Útil</th>
                  <th className="px-3 py-2.5 text-left">Fabricante</th>
                  <th className="px-3 py-2.5 text-left">Lote</th>
                </tr>
              </thead>
              <tbody>
                {enAlmacen.data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-concreto">
                      No hay piezas en Almacén para este filtro.
                    </td>
                  </tr>
                )}
                {enAlmacen.data?.rows.map((eje) => {
                  const ids = [eje.izquierdo?.discoId, eje.derecho?.discoId].filter((id): id is string => Boolean(id))
                  const marcada = ids.length > 0 && ids.every((id) => seleccion.has(id))
                  const vidaUtil = vidaUtilPorcentaje(eje.izquierdo?.tValue ?? null, eje.derecho?.tValue ?? null)
                  return (
                    <tr
                      key={eje.clave}
                      onClick={() => alternarPar(ids)}
                      className="tabla-fila--glass cursor-pointer border-b border-concreto/10"
                    >
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={marcada} readOnly className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-2 font-semibold text-concreto-oscuro">
                        {eje.serie ? `${eje.serie}-D` : '(sin serie)'}
                      </td>
                      <td className="px-3 py-2">
                        <MedidasEjeSplit izquierdo={eje.izquierdo} derecho={eje.derecho} />
                      </td>
                      <td className="px-3 py-2 text-right font-data">{vidaUtil.toFixed(0)}%</td>
                      <td className="px-3 py-2">{eje.fabricante ? ETIQUETA_FABRICANTE[eje.fabricante] : '—'}</td>
                      <td className="px-3 py-2">{eje.lote ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>

        <div className="shrink-0 space-y-3 border-t border-concreto/15 pt-4">
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
              label="P.T."
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
              htmlFor="retiro-masivo-observaciones"
              className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
            >
              Observaciones
            </label>
            <textarea
              id="retiro-masivo-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
              rows={2}
              className="glass-field w-full px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="shrink-0 font-body text-sm text-[color:var(--color-estado-critico)]">
            ⚠ {error}
          </p>
        )}
      </div>
    </GlassModal>
  )
}
