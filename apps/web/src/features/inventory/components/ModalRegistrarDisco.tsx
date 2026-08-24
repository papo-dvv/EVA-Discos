import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { useRegistrarDisco } from '../queries'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'

// Alta de una pieza nueva de stock en Almacén — no pedida explícitamente en
// el enunciado original, pero indispensable: sin esto Almacén queda vacío
// para siempre y Retiro Masivo/Cambio de Disco no tendrían de dónde partir.
// Sin selector de proveedor por ahora (no existe todavía un catálogo/feature
// de proveedores en el frontend) — se puede vincular más adelante.
export function ModalRegistrarDisco({ onCerrar }: { onCerrar: () => void }) {
  const [serie, setSerie] = useState('')
  const [marcaRueda, setMarcaRueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const registrar = useRegistrarDisco()

  async function confirmar() {
    setError(null)
    try {
      await registrar.mutateAsync({
        serie: serie.trim(),
        marcaRueda: marcaRueda.trim() || undefined,
      })
      onCerrar()
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo registrar la pieza.'))
    }
  }

  return (
    <GlassModal
      titulo="Agregar disco al inventario"
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
        La pieza entra directo a Almacén, fase Nueva. Todavía no tiene una
        posición física asignada — eso ocurre recién con un Cambio de Disco.
      </p>
      <div className="space-y-3">
        <GlassField
          label="Serie *"
          value={serie}
          onChange={(e) => setSerie(e.target.value)}
          placeholder="Ej. M148-D"
          maxLength={100}
        />
        <GlassField
          label="Marca de la rueda"
          value={marcaRueda}
          onChange={(e) => setMarcaRueda(e.target.value)}
          placeholder="Opcional"
          maxLength={100}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
          ⚠ {error}
        </p>
      )}
    </GlassModal>
  )
}
