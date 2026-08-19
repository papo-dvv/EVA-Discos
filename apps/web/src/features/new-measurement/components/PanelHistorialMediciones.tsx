import {
  CheckCircle2,
  FileUp,
  Lock,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useHistorialMediciones } from '../queries'
import type { EventoHistorialApi, TipoEventoHistorialMedicion } from '../types'

const ICONO_POR_TIPO: Record<TipoEventoHistorialMedicion, ReactNode> = {
  csv_subido: <FileUp size={15} aria-hidden />,
  csv_duplicado_bloqueado: <ShieldAlert size={15} aria-hidden />,
  ficha_creada_manual: <PlusCircle size={15} aria-hidden />,
  ficha_reiniciada: <RotateCcw size={15} aria-hidden />,
  ficha_cancelada: <XCircle size={15} aria-hidden />,
  ficha_bloqueada: <Lock size={15} aria-hidden />,
  ficha_confirmada: <CheckCircle2 size={15} aria-hidden />,
}

const TEXTO_POR_TIPO: Record<TipoEventoHistorialMedicion, string> = {
  csv_subido: 'Subió una medición',
  csv_duplicado_bloqueado: 'Intento de carga repetida bloqueado',
  ficha_creada_manual: 'Creó una ficha manual',
  ficha_reiniciada: 'Reinició la ficha',
  ficha_cancelada: 'Canceló la ficha',
  ficha_bloqueada: 'Bloqueó la tabla de mediciones',
  ficha_confirmada: 'Confirmó la ficha',
}

// "hace 5 min" / "hace 3 h" / "hace 2 d" — sin dependencia externa de fechas,
// alcanza con este desglose simple para un feed que rara vez pasa de días.
function fechaRelativa(iso: string): string {
  const segundos = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (segundos < 60) return 'recién'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} d`
}

function FilaEvento({ evento }: { evento: EventoHistorialApi }) {
  return (
    <li className="flex items-start gap-2 border-b border-concreto/10 py-2.5 last:border-none">
      <span className="mt-0.5 shrink-0 text-concreto">{ICONO_POR_TIPO[evento.tipo]}</span>
      <div className="min-w-0">
        <p className="font-body text-xs font-semibold text-concreto-oscuro">
          Tren {evento.trenNumero} — {TEXTO_POR_TIPO[evento.tipo]}
        </p>
        {evento.nombreArchivo && (
          <p className="truncate font-body text-[0.6875rem] text-concreto" title={evento.nombreArchivo}>
            {evento.nombreArchivo}
          </p>
        )}
        <p className="font-body text-[0.6875rem] text-concreto">
          {evento.usuarioNombre} · {fechaRelativa(evento.createdAt)}
        </p>
      </div>
    </li>
  )
}

// Card de historial GLOBAL (todos los trenes, un solo feed) de eventos de
// carga de mediciones — vive siempre montada en Nuevas Mediciones (con o sin
// ficha abierta), a diferencia del resto de la página que depende de
// fichaId/tren. Ver NewMeasurementHistoryService (backend) para qué eventos
// se registran.
export function PanelHistorialMediciones() {
  const historial = useHistorialMediciones()

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h2 className="mb-3 font-display text-sm font-semibold text-concreto-oscuro">Historial de mediciones</h2>

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
