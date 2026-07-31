import { useEffect, useRef, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useNotificaciones } from '../queries'
import type { Notificacion, SeveridadNotificacion, TipoNotificacion } from '../types'

const ETIQUETA_TIPO: Partial<Record<TipoNotificacion, string>> = {
  disco_critico: 'Disco crítico',
  solicitud_registro_pendiente: 'Solicitud de registro pendiente',
  outlier_detectado: 'Outlier detectado',
  evento_calendario_proximo: 'Evento próximo',
  password_temporal_generada: 'Contraseña temporal generada',
  consenso_extremo_ajustado: 'Consenso ajustado automáticamente',
}

// Tono §6 (fuera de la tabla de mediciones — acá no aplica §6.1) por
// severidad: advertencia usa el ámbar tierra, nunca el rojo de crítico,
// mismo criterio que el aviso inline de PanelParametros.
const COLOR_SEVERIDAD: Record<SeveridadNotificacion, string> = {
  info: 'var(--color-verde-institucional)',
  advertencia: 'var(--color-estado-seguimiento)',
  critico: 'var(--color-estado-critico)',
}

// De más a menos urgente — decide el color del punto de la campanita cuando
// hay varias notificaciones con distinta severidad.
const PRIORIDAD_SEVERIDAD: SeveridadNotificacion[] = ['critico', 'advertencia', 'info']

function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// Campanita de notificaciones — versión mínima de solo lectura (GET /notifications,
// sin marcar-leída ni conteo de no leídas): abre un panel desplegable con las
// notificaciones del usuario (propias o de su rol), más recientes primero.
// Cierra al clic fuera o Escape, mismo patrón que <MultiSelect>.
export function CampanitaNotificaciones() {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement | null>(null)
  const notificaciones = useNotificaciones()

  useEffect(() => {
    if (!abierto) return
    const alClic = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  const items = notificaciones.data ?? []
  const peorSeveridad = PRIORIDAD_SEVERIDAD.find((s) => items.some((n) => n.severidad === s))

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={items.length > 0 ? `Notificaciones (${items.length})` : 'Notificaciones'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors hover:bg-white/60"
      >
        🔔
        {peorSeveridad && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-white"
            style={{ background: COLOR_SEVERIDAD[peorSeveridad] }}
          />
        )}
      </button>

      {abierto && (
        <GlassSurface fuerte className="absolute right-0 z-30 mt-2 w-80 rounded-glass-sm p-2">
          <p className="px-2 py-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Notificaciones
          </p>
          {notificaciones.isLoading ? (
            <p className="px-2 py-3 font-body text-sm text-concreto">Cargando…</p>
          ) : notificaciones.isError ? (
            <p role="alert" className="px-2 py-3 font-body text-sm text-[color:var(--color-estado-critico)]">
              {extraerMensajeError(notificaciones.error)}
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 font-body text-sm text-concreto">Sin novedades.</p>
          ) : (
            <ScrollArea viewportClassName="max-h-80">
              <ul className="space-y-1">
                {items.map((n) => (
                  <FilaNotificacion key={n.id} notificacion={n} />
                ))}
              </ul>
            </ScrollArea>
          )}
        </GlassSurface>
      )}
    </div>
  )
}

function FilaNotificacion({ notificacion }: { notificacion: Notificacion }) {
  return (
    <li className="rounded-xl px-2.5 py-2 transition-colors hover:bg-white/50">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: COLOR_SEVERIDAD[notificacion.severidad] }}
        />
        <div className="min-w-0">
          <p className="font-body text-[11px] font-semibold uppercase tracking-wide text-concreto">
            {ETIQUETA_TIPO[notificacion.tipo] ?? notificacion.tipo}
          </p>
          <p className="font-body text-sm text-concreto-oscuro">{notificacion.mensaje}</p>
          <p className="mt-0.5 font-data text-[11px] text-concreto">
            {formatearFechaHora(notificacion.createdAt)}
          </p>
        </div>
      </div>
    </li>
  )
}
