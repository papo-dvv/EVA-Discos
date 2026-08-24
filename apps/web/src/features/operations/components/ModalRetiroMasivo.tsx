import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { FirmaDigital } from '../../new-measurement/components/FirmaDigital'
import { useInventario, useStatsInventario } from '../../inventory/queries'
import { useRetiroMasivo } from '../queries'

export function ModalRetiroMasivo({ onCerrar }: { onCerrar: () => void }) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [encargadoNombre, setEncargadoNombre] = useState('')
  const [firma, setFirma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const stats = useStatsInventario()
  const enAlmacen = useInventario({ page: 1, pageSize: 200, stage: ['almacen'] })
  const retiro = useRetiroMasivo()

  function alternar(id: string) {
    setSeleccion((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  async function confirmar() {
    setError(null)
    try {
      await retiro.mutateAsync({
        discIds: [...seleccion],
        encargadoNombre: encargadoNombre.trim(),
        encargadoFirma: firma || undefined,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo completar el retiro masivo.'))
    }
  }

  const puedeConfirmar = seleccion.size > 0 && encargadoNombre.trim().length > 0

  return (
    <GlassModal
      titulo="Retiro masivo"
      onCerrar={onCerrar}
      ancho={640}
      altoMaximo="85vh"
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
              Confirmar retiro
            </GlassButton>
          </div>
        </div>
      }
    >
      <div className="mb-4 grid shrink-0 grid-cols-2 gap-3">
        <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Taller</p>
          <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{stats.data?.taller ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-concreto">Almacén</p>
          <p className="mt-0.5 font-data text-xl font-semibold text-concreto-oscuro">{stats.data?.almacen ?? '—'}</p>
        </div>
      </div>

      <p className="mb-2 shrink-0 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
        Discos en Almacén
      </p>
      <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
        <div className="space-y-1.5 pr-1">
          {enAlmacen.data?.rows.length === 0 && (
            <p className="px-2 py-4 text-center font-body text-sm text-concreto">No hay piezas en Almacén.</p>
          )}
          {enAlmacen.data?.rows.map((disco) => (
            <label
              key={disco.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-concreto/10 bg-white/45 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={seleccion.has(disco.id)}
                onChange={() => alternar(disco.id)}
                className="h-4 w-4"
              />
              <span className="font-semibold text-concreto-oscuro">{disco.serie ?? '(sin serie)'}</span>
              {disco.marcaRueda && <span className="text-concreto">· {disco.marcaRueda}</span>}
              {disco.fabricante && <span className="text-concreto">· {disco.fabricante}</span>}
            </label>
          ))}
        </div>
      </ScrollArea>

      {seleccion.size > 0 && (
        <div className="mt-4 shrink-0 space-y-3 border-t border-concreto/15 pt-4">
          <GlassField
            label="Encargado *"
            value={encargadoNombre}
            onChange={(e) => setEncargadoNombre(e.target.value)}
            placeholder="Nombre del encargado"
          />
          <div>
            <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Firma</p>
            <FirmaDigital etiqueta="Encargado" valor={firma} onGuardar={setFirma} />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 shrink-0 font-body text-sm text-[color:var(--color-estado-critico)]">
          ⚠ {error}
        </p>
      )}
    </GlassModal>
  )
}
