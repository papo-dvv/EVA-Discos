import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSelect } from '../../../components/GlassSelect'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useEditarEje } from '../queries'
import { ETIQUETA_FABRICANTE, FABRICANTES, type Fabricante, type InventoryRow } from '../types'

const OPCIONES_FABRICANTE = FABRICANTES.map((f) => ({ valor: f, etiqueta: ETIQUETA_FABRICANTE[f] }))

// Edita solo identidad del eje (serie/lote/fabricante/marca) — Estado se
// calcula de la medición (no editable), Fase/Último movimiento son
// historial de las operaciones de Taller/Almacén/Operaciones (tampoco).
export function ModalEditarEje({ eje, onCerrar }: { eje: InventoryRow; onCerrar: () => void }) {
  const [serie, setSerie] = useState(eje.serie ?? '')
  const [lote, setLote] = useState(eje.lote ?? '')
  const [fabricante, setFabricante] = useState<Fabricante | undefined>(eje.fabricante ?? undefined)
  const [marcaRueda, setMarcaRueda] = useState(eje.marcaRueda ?? '')
  const [error, setError] = useState<string | null>(null)
  const editar = useEditarEje()

  async function confirmar() {
    if (!eje.serie) return
    setError(null)
    try {
      await editar.mutateAsync({
        serie: eje.serie,
        cambios: {
          serie: serie.trim(),
          lote: lote.trim(),
          fabricante,
          marcaRueda: marcaRueda.trim(),
        },
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo editar el eje.'))
    }
  }

  return (
    <GlassModal
      titulo="Editar eje"
      onCerrar={onCerrar}
      ancho={440}
      footer={
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton type="button" cargando={editar.isPending} disabled={!serie.trim()} onClick={confirmar}>
            Guardar
          </GlassButton>
        </div>
      }
    >
      <div className="space-y-3">
        <GlassField label="Serie del eje *" value={serie} onChange={(e) => setSerie(e.target.value)} maxLength={100} />
        <GlassField label="Lote" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Opcional" maxLength={100} />
        <GlassSelect
          label="Fabricante (tren compatible)"
          opciones={OPCIONES_FABRICANTE}
          seleccion={fabricante}
          onCambiar={(v) => setFabricante(v as Fabricante | undefined)}
        />
        <GlassField label="Marca de disco" value={marcaRueda} onChange={(e) => setMarcaRueda(e.target.value)} placeholder="Opcional" maxLength={100} />
      </div>
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
          ⚠ {error}
        </p>
      )}
    </GlassModal>
  )
}
