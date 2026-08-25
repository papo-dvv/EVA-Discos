import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSelect } from '../../../components/GlassSelect'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useRegistrarEje } from '../queries'
import { ETIQUETA_FABRICANTE, FABRICANTES, type Fabricante } from '../types'

const OPCIONES_FABRICANTE = FABRICANTES.map((f) => ({ valor: f, etiqueta: ETIQUETA_FABRICANTE[f] }))

// Alta de un EJE nuevo de stock: izquierdo + derecho juntos, comparten
// serie (ver comentario de BrakeDisc.serie en el backend). Entra a Almacén
// por defecto, fase Nueva — salvo que se marque "retirado automático",
// caso en el que entra directo a Taller (pero SIGUE siendo fase Nueva: la
// regla de negocio dice que una pieza recién dada de alta nunca es 'usada'
// hasta que pasa por en_servicio, sin importar el stage destino).
export function ModalRegistrarDisco({ onCerrar }: { onCerrar: () => void }) {
  const [serie, setSerie] = useState('')
  const [lote, setLote] = useState('')
  const [fabricante, setFabricante] = useState<Fabricante | undefined>(undefined)
  const [marcaRueda, setMarcaRueda] = useState('')
  const [autoTaller, setAutoTaller] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const registrar = useRegistrarEje()

  async function confirmar() {
    setError(null)
    try {
      await registrar.mutateAsync({
        serie: serie.trim(),
        lote: lote.trim() || undefined,
        fabricante,
        marcaRueda: marcaRueda.trim() || undefined,
        autoTaller,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo registrar el eje.'))
    }
  }

  return (
    <GlassModal
      titulo="Agregar eje al inventario"
      onCerrar={onCerrar}
      ancho={440}
      footer={
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </GlassButton>
          <GlassButton
            type="button"
            cargando={registrar.isPending}
            disabled={!serie.trim()}
            onClick={confirmar}
          >
            Agregar
          </GlassButton>
        </div>
      }
    >
      <p className="mb-4 font-body text-sm text-concreto">
        Se crean los 2 discos del eje (izquierdo y derecho), con la misma serie. Entra a
        Almacén y fase Nueva, salvo que marques "retirado automático a Taller" abajo.
      </p>
      <div className="space-y-3">
        <GlassField
          label="Serie del eje *"
          value={serie}
          onChange={(e) => setSerie(e.target.value)}
          placeholder="Ej. MIG-D9176D95"
          maxLength={100}
        />
        <GlassField
          label="Lote"
          value={lote}
          onChange={(e) => setLote(e.target.value)}
          placeholder="Opcional"
          maxLength={100}
        />
        <GlassSelect
          label="Fabricante (tren compatible)"
          opciones={OPCIONES_FABRICANTE}
          seleccion={fabricante}
          onCambiar={(v) => setFabricante(v as Fabricante | undefined)}
        />
        <GlassField
          label="Marca de disco"
          value={marcaRueda}
          onChange={(e) => setMarcaRueda(e.target.value)}
          placeholder="Opcional"
          maxLength={100}
        />
        <label className="flex items-center gap-2 font-body text-sm text-concreto-oscuro">
          <input
            type="checkbox"
            checked={autoTaller}
            onChange={(e) => setAutoTaller(e.target.checked)}
            className="h-4 w-4"
          />
          Retirado automático a Taller (en vez de Almacén)
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
          ⚠ {error}
        </p>
      )}
    </GlassModal>
  )
}
