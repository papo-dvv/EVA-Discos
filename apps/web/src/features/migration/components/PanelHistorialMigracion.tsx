import { CheckCircle2, FileUp, XCircle, type LucideIcon } from 'lucide-react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useHistorialMigracion } from '../queries'
import type { EventoHistorialMigracionApi, TipoEventoHistorialMigracion } from '../types'

const ICONO_POR_TIPO: Record<TipoEventoHistorialMigracion, LucideIcon> = {
  migracion_subida: FileUp,
  migracion_confirmada: CheckCircle2,
  migracion_cancelada: XCircle,
}

const TEXTO_POR_TIPO: Record<TipoEventoHistorialMigracion, string> = {
  migracion_subida: 'Subió una migración',
  migracion_confirmada: 'Confirmó la migración',
  migracion_cancelada: 'Canceló la migración',
}

function fechaRelativa(iso: string): string {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (segundos < 60) return 'recién'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} d`
}

function alcance(evento: EventoHistorialMigracionApi): string {
  if (evento.trenNumero !== null) return `Tren ${evento.trenNumero}`
  if (evento.marca) return evento.marca
  if (evento.alcance === 'todos') return 'Todos'
  return 'Migración masiva'
}

function FilaEvento({ evento }: { evento: EventoHistorialMigracionApi }) {
  const Icono = ICONO_POR_TIPO[evento.tipo]
  const color =
    evento.tipo === 'migracion_confirmada'
      ? 'text-verde-oscuro'
      : evento.tipo === 'migracion_cancelada'
        ? 'text-[color:var(--color-estado-critico)]'
        : 'text-concreto'

  return (
    <li className="flex items-start gap-2 border-b border-concreto/10 py-2.5 last:border-none">
      <Icono size={15} aria-hidden className={`mt-0.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="font-body text-xs font-semibold text-concreto-oscuro">
          {alcance(evento)} — {TEXTO_POR_TIPO[evento.tipo]}
        </p>
        {evento.nombreArchivo && (
          <p className="truncate font-body text-[0.6875rem] text-concreto" title={evento.nombreArchivo}>
            {evento.nombreArchivo}
          </p>
        )}
        <p className="font-body text-[0.6875rem] text-concreto">
          {evento.usuarioNombre} · {fechaRelativa(evento.createdAt)}
        </p>
        {evento.filasValidas !== null && (
          <p className="font-data text-[0.6875rem] text-concreto">
            {evento.filasValidas} válidas
            {evento.filasInvalidas !== null ? ` · ${evento.filasInvalidas} inválidas` : ''}
          </p>
        )}
      </div>
    </li>
  )
}

export function PanelHistorialMigracion() {
  const historial = useHistorialMigracion()

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h2 className="mb-3 font-display text-sm font-semibold text-concreto-oscuro">
        Historial de migraciones
      </h2>

      {historial.isLoading ? (
        <p className="font-body text-xs text-concreto">Cargando…</p>
      ) : historial.isError ? (
        <p role="alert" className="font-body text-xs text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(historial.error)}
        </p>
      ) : !historial.data || historial.data.length === 0 ? (
        <p className="font-body text-xs text-concreto">Todavía no hay eventos registrados.</p>
      ) : (
        <ScrollArea viewportClassName="max-h-[32rem]">
          <ul>
            {historial.data.map((evento) => (
              <FilaEvento key={evento.id} evento={evento} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </GlassSurface>
  )
}
