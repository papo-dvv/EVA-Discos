import { useState } from 'react'
import type { ReactNode } from 'react'
import { extraerMensajeError } from '../lib/extraerMensajeError'
import { GlassButton } from './GlassButton'
import { GlassModal } from './GlassModal'
import { WarningTooltip } from './WarningTooltip'

// Progreso opcional (ej. lotes de un commit masivo): deja la pieza visual
// lista para cuando exista polling de progreso real (ver prompt de commit por
// lotes), sin necesidad de otro componente ni de rehacer este.
export type ConfirmDialogProgreso = {
  actual: number
  total: number
  etiqueta?: ReactNode
}

type ConfirmDialogVariante = 'default' | 'danger'

type ConfirmDialogProps = {
  titulo: ReactNode
  mensaje?: ReactNode
  textoConfirmar?: string
  textoCancelar?: string
  variante?: ConfirmDialogVariante
  // Puede devolver una promesa: mientras no resuelva, el botón de acción
  // queda en estado de carga (spinner + disabled). Si rechaza, el mensaje de
  // error se muestra en el propio modal y NO se cierra. Si resuelve, el modal
  // se cierra solo (llama a onCerrar).
  onConfirm: () => void | Promise<void>
  onCerrar: () => void
  progreso?: ConfirmDialogProgreso | null
  children?: ReactNode
  ancho?: number
  // Si se define, el botón de confirmar queda deshabilitado (aria-disabled,
  // sigue enfocable/hoverable — nunca el atributo `disabled`, que apagaría el
  // WarningTooltip que lo envuelve) mostrando este motivo en un WarningTooltip
  // — para requisitos previos que el propio modal no resuelve (ej. P.T.
  // vacío antes de poder bloquear la ficha). null/undefined: el botón
  // funciona como siempre.
  motivoConfirmarDeshabilitado?: string | null
  // Con motivoConfirmarDeshabilitado presente, reemplaza el botón "deshabilitado
  // + tooltip" de siempre por un botón normal (habilitado) que dispara esta
  // acción en vez de onConfirm — ej. "Llenar ahora" en el modal de bloqueo de
  // Nuevas Mediciones, que cierra el modal y hace scroll al campo faltante en
  // vez de simplemente explicar por qué no se puede confirmar.
  accionAlternativa?: { texto: string; onClick: () => void } | null
}

// Confirmación reutilizable con estética Liquid Glass (styles.md §4/§9): un
// solo componente para TODO diálogo de confirmar/cancelar de la app — no
// duplicar esta lógica por pantalla (ej. guardar parámetro, cancelar
// migración masiva, eliminar fila/tren).
export function ConfirmDialog({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  variante = 'default',
  onConfirm,
  onCerrar,
  progreso = null,
  children,
  ancho,
  motivoConfirmarDeshabilitado = null,
  accionAlternativa = null,
}: ConfirmDialogProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function manejarConfirmar() {
    setError(null)
    setCargando(true)
    try {
      await onConfirm()
      onCerrar()
    } catch (err) {
      setError(err)
    } finally {
      setCargando(false)
    }
  }

  const esPeligro = variante === 'danger'
  // Mientras carga, ni Escape ni el clic fuera cierran el modal (no se debe
  // poder "perder" un onConfirm en curso).
  const cerrarModal = cargando ? () => {} : onCerrar
  const porcentaje = progreso
    ? Math.min(100, Math.round((progreso.actual / Math.max(progreso.total, 1)) * 100))
    : 0

  return (
    <GlassModal titulo={titulo} onCerrar={cerrarModal} ancho={ancho}>
      {mensaje && <p className="font-body text-sm text-concreto-oscuro">{mensaje}</p>}
      {children}

      {progreso && (
        <div className="mt-4">
          {progreso.etiqueta && (
            <p className="mb-1.5 font-body text-xs text-concreto">{progreso.etiqueta}</p>
          )}
          <div
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-white/50"
          >
            <div
              className="h-full rounded-full bg-verde-institucional transition-[width] duration-300 ease-out"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="mt-1 text-right font-data text-xs text-concreto">
            {progreso.actual}/{progreso.total}
          </p>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(error)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <GlassButton
          type="button"
          variante="secundario"
          onClick={onCerrar}
          disabled={cargando}
          className="px-5 py-2.5 text-xs"
        >
          {textoCancelar}
        </GlassButton>
        {motivoConfirmarDeshabilitado && accionAlternativa ? (
          // Con accionAlternativa, el motivo no deshabilita el botón — lo
          // reemplaza por una acción de ayuda (ej. "Llenar ahora": cierra el
          // modal y hace scroll al campo faltante) en vez de solo explicar por
          // WarningTooltip qué falta.
          <WarningTooltip texto={motivoConfirmarDeshabilitado}>
            <GlassButton type="button" onClick={accionAlternativa.onClick} className="px-5 py-2.5 text-xs">
              {accionAlternativa.texto}
            </GlassButton>
          </WarningTooltip>
        ) : motivoConfirmarDeshabilitado ? (
          // aria-disabled (nunca `disabled`): un botón nativo disabled no
          // dispara mouseenter/focus ni en él ni en sus ancestros, así que el
          // WarningTooltip que lo envuelve jamás llegaría a mostrarse por
          // hover/teclado — mismo criterio ya usado en SegmentedControl.
          <WarningTooltip texto={motivoConfirmarDeshabilitado}>
            <GlassButton
              type="button"
              aria-disabled="true"
              className="cursor-not-allowed px-5 py-2.5 text-xs opacity-60"
              style={
                esPeligro
                  ? { background: 'var(--color-estado-critico)', borderColor: 'var(--color-estado-critico)' }
                  : undefined
              }
            >
              {textoConfirmar}
            </GlassButton>
          </WarningTooltip>
        ) : (
          <GlassButton
            type="button"
            onClick={manejarConfirmar}
            cargando={cargando}
            className="px-5 py-2.5 text-xs"
            style={
              esPeligro
                ? { background: 'var(--color-estado-critico)', borderColor: 'var(--color-estado-critico)' }
                : undefined
            }
          >
            {cargando ? `${textoConfirmar}…` : textoConfirmar}
          </GlassButton>
        )}
      </div>
    </GlassModal>
  )
}
