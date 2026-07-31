import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import type { CambiosFila, PreviewRow } from '../types'

const CAMPOS_BASE: [keyof CambiosFila, string, string][] = [
  ['responsableNombre', 'Responsable', 'text'],
  ['trenNumero', 'Tren', 'number'],
  ['kilometraje', 'Kilometraje', 'number'],
  ['fecha', 'Fecha', 'date'],
  ['motivo', 'Motivo', 'text'],
  ['hValue', 'H', 'number'],
  ['tValue', 'T', 'number'],
]

// Modal de edición de una fila — puramente presentacional (no sabe si está
// editando un borrador o un registro confirmado, ni a qué endpoint pega): la
// página dueña le pasa el hook de mutación ya resuelto vía onGuardar/guardando
// /error. `mostrarTren` oculta el campo Tren en modo confirmado — el backend
// de confirmados (PATCH /scan-records/:id) no acepta cambiar el tren, porque
// eso desincronizaría el disc_id ya resuelto en el commit.
type Props = {
  fila: PreviewRow
  mostrarTren: boolean
  guardando: boolean
  error: unknown
  onGuardar: (cambios: CambiosFila) => void
  onCerrar: () => void
}

export function ModalEditarFila({ fila, mostrarTren, guardando, error, onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState({
    responsableNombre: fila.responsableNombre,
    trenNumero: String(fila.trenNumero),
    kilometraje: String(fila.kilometraje),
    fecha: fila.fecha,
    motivo: fila.motivo,
    hValue: String(fila.hValue),
    tValue: String(fila.tValue),
  })

  function guardar() {
    const cambios: CambiosFila = {
      responsableNombre: form.responsableNombre,
      kilometraje: Number(form.kilometraje),
      fecha: form.fecha,
      motivo: form.motivo,
      hValue: Number(form.hValue),
      tValue: Number(form.tValue),
    }
    if (mostrarTren) cambios.trenNumero = Number(form.trenNumero)
    onGuardar(cambios)
  }

  const campos = CAMPOS_BASE.filter(([campo]) => mostrarTren || campo !== 'trenNumero')

  return (
    <GlassModal titulo="Editar fila" onCerrar={onCerrar}>
      <p className="mb-4 font-body text-sm text-concreto">
        Rd y estado se recalculan solos al cambiar H o T.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {campos.map(([campo, label, tipo]) => (
          <GlassField
            key={campo}
            label={label}
            type={tipo}
            step="any"
            value={form[campo as keyof typeof form]}
            onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
            contenedorClassName={campo === 'responsableNombre' || campo === 'motivo' ? 'col-span-2' : ''}
          />
        ))}
      </div>
      {error !== null && error !== undefined && (
        <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(error)}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <GlassButton variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
          Cancelar
        </GlassButton>
        <GlassButton onClick={guardar} cargando={guardando} className="px-5 py-2.5 text-xs">
          {guardando ? 'Guardando…' : 'Guardar'}
        </GlassButton>
      </div>
    </GlassModal>
  )
}
