import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import type { ResumenVerificacion } from '../types'

type Props = {
  resumen: ResumenVerificacion
  esOrigenCsv: boolean
  onCorregir: () => void
  onReiniciar: () => Promise<void>
}

// Punto 6 del enunciado: header (título + descripción) / body (lista
// scrolleable) / footer (fijo, siempre visible) — reemplaza al ConfirmDialog
// genérico que se usaba antes acá, que dejaba crecer el modal sin límite: con
// hasta 48 filas con problema, el footer (los únicos 2 botones de acción)
// terminaba fuera de la pantalla. Altura máxima fija (80vh, ver GlassModal)
// con solo la lista scrolleando internamente.
//
// Modelo BINARIO (punto 3): ya no existe "commit parcial con las filas
// válidas" — la única salida es corregir cada fila manualmente (cerrar este
// modal y editar, luego volver a Verificar) o reiniciar la ficha completa.
export function ModalFilasConProblemas({ resumen, esOrigenCsv, onCorregir, onReiniciar }: Props) {
  const [reiniciando, setReiniciando] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function manejarReiniciar() {
    setError(null)
    setReiniciando(true)
    try {
      await onReiniciar()
    } catch (err) {
      setError(err)
      setReiniciando(false)
    }
  }

  return (
    <GlassModal
      titulo="Quedan filas con problemas"
      onCerrar={reiniciando ? () => {} : onCorregir}
      altoMaximo="80vh"
      footer={
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <GlassButton
            type="button"
            variante="secundario"
            onClick={onCorregir}
            disabled={reiniciando}
            className="px-5 py-2.5 text-xs"
          >
            Corregir manualmente
          </GlassButton>
          <GlassButton
            type="button"
            onClick={manejarReiniciar}
            cargando={reiniciando}
            className="px-5 py-2.5 text-xs"
            style={{ background: 'var(--color-estado-critico)', borderColor: 'var(--color-estado-critico)' }}
          >
            {esOrigenCsv ? 'Resubir CSV' : 'Reiniciar ficha'}
          </GlassButton>
        </div>
      }
    >
      <p className="shrink-0 font-body text-sm text-concreto-oscuro">
        {resumen.filasExcluidas.length > 0
          ? `${resumen.filasExcluidas.length} fila(s) siguen con algún problema.`
          : 'El Kilometraje o la Fecha del header quedaron por debajo del último registro confirmado de este tren (ver la alerta junto a esos campos).'}{' '}
        No se puede bloquear ni confirmar la ficha hasta que pase la verificación — corregí manualmente (editar +
        volver a Verificar) o reiniciá la ficha completa para empezar de nuevo.
      </p>

      {error !== null && (
        <p role="alert" className="mt-3 shrink-0 font-body text-sm text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(error)}
        </p>
      )}

      <ScrollArea className="mt-3 min-h-0 flex-1" viewportClassName="h-full">
        <ul className="space-y-1 font-body text-xs text-concreto-oscuro">
          {resumen.filasExcluidas.map((f) => (
            <li key={f.recordId}>
              Eje {f.eje ?? '—'} · {f.lado ?? '—'} — {f.motivos.map((m) => m.motivo).join('; ')}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </GlassModal>
  )
}
