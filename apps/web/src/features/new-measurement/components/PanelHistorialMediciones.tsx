import {
  CheckCircle2,
  ChevronDown,
  FileUp,
  Lock,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { useHistorialMediciones } from '../queries'
import type { EventoHistorialApi, MotivoFicha, TipoEventoHistorialMedicion } from '../types'

const ICONO_POR_TIPO: Record<TipoEventoHistorialMedicion, ReactNode> = {
  csv_subido: <FileUp size={15} aria-hidden />,
  csv_duplicado_bloqueado: <ShieldAlert size={15} aria-hidden />,
  ficha_creada_manual: <PlusCircle size={15} aria-hidden />,
  ficha_reiniciada: <RotateCcw size={15} aria-hidden />,
  ficha_cancelada: <XCircle size={15} aria-hidden />,
  ficha_bloqueada: <Lock size={15} aria-hidden />,
  ficha_confirmada: <CheckCircle2 size={15} aria-hidden />,
}

const TEXTO_MEDICION_POR_TIPO: Record<TipoEventoHistorialMedicion, string> = {
  csv_subido: 'Subió una medición',
  csv_duplicado_bloqueado: 'Intento de carga repetida bloqueado',
  ficha_creada_manual: 'Creó una ficha manual',
  ficha_reiniciada: 'Reinició la ficha',
  ficha_cancelada: 'Canceló la ficha',
  ficha_bloqueada: 'Bloqueó la tabla de mediciones',
  ficha_confirmada: 'Confirmó la ficha',
}

const TEXTO_REPERFILADO_POR_TIPO: Record<TipoEventoHistorialMedicion, string> = {
  csv_subido: 'Subió un reperfilado',
  csv_duplicado_bloqueado: 'Intento de carga repetida bloqueado',
  ficha_creada_manual: 'Creó una ficha manual',
  ficha_reiniciada: 'Reinició la ficha',
  ficha_cancelada: 'Canceló la ficha',
  ficha_bloqueada: 'Bloqueó la tabla de reperfilado',
  ficha_confirmada: 'Confirmó el reperfilado',
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

function FilaEvento({
  evento,
  textoPorTipo,
}: {
  evento: EventoHistorialApi
  textoPorTipo: Record<TipoEventoHistorialMedicion, string>
}) {
  return (
    <li className="flex items-start gap-2 border-b border-concreto/10 py-2.5 last:border-none">
      <span className="mt-0.5 shrink-0 text-concreto">{ICONO_POR_TIPO[evento.tipo]}</span>
      <div className="min-w-0">
        <p className="font-body text-xs font-semibold text-concreto-oscuro">
          Tren {evento.trenNumero} — {textoPorTipo[evento.tipo]}
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

// tipo del evento MÁS RECIENTE de una racha (grupo[0], ver agruparPorArchivo)
// que cuenta como desenlace final — el resto de los tipos (subida, bloqueo,
// reinicio) son intermedios: la racha sigue "abierta" y no lleva check/x.
type Resultado = 'concretada' | 'cancelada'

const RESULTADO_POR_TIPO: Partial<Record<TipoEventoHistorialMedicion, Resultado>> = {
  ficha_confirmada: 'concretada',
  ficha_cancelada: 'cancelada',
}

const COLOR_POR_RESULTADO: Record<Resultado, string> = {
  concretada: 'var(--color-verde-institucional)',
  cancelada: 'var(--color-estado-critico)',
}

const ICONO_POR_RESULTADO: Record<Resultado, ReactNode> = {
  concretada: <CheckCircle2 size={15} aria-hidden />,
  cancelada: <XCircle size={15} aria-hidden />,
}

// Racha de 2+ eventos CONSECUTIVOS (sin otro archivo intercalado) del mismo
// nombreArchivo — colapsa en una sola fila desplegable con el desenlace
// (check/x) del evento más reciente. Ver agruparPorArchivo.
function FilaGrupo({
  grupo,
  textoPorTipo,
}: Readonly<{
  grupo: EventoHistorialApi[]
  textoPorTipo: Record<TipoEventoHistorialMedicion, string>
}>) {
  const [abierto, setAbierto] = useState(false)
  const reciente = grupo[0]
  const resultado = RESULTADO_POR_TIPO[reciente.tipo]
  const icono = resultado ? ICONO_POR_RESULTADO[resultado] : ICONO_POR_TIPO[reciente.tipo]
  const color = resultado ? COLOR_POR_RESULTADO[resultado] : 'var(--color-gris-concreto)'

  return (
    <li className="border-b border-concreto/10 py-2.5 last:border-none">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="mt-0.5 shrink-0" style={{ color }}>
          {icono}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-xs font-semibold text-concreto-oscuro" title={reciente.nombreArchivo ?? undefined}>
            Tren {reciente.trenNumero} — {reciente.nombreArchivo}
          </p>
          <p className="font-body text-[0.6875rem] text-concreto">
            {grupo.length} acciones · {reciente.usuarioNombre} · {fechaRelativa(reciente.createdAt)}
          </p>
        </div>
        <ChevronDown
          size={14}
          aria-hidden
          className={`mt-0.5 shrink-0 text-concreto transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <ul className="mt-1 ml-5 border-l border-concreto/15 pl-3">
          {grupo.map((evento) => (
            <FilaEvento key={evento.id} evento={evento} textoPorTipo={textoPorTipo} />
          ))}
        </ul>
      )}
    </li>
  )
}

type ItemHistorial =
  | { tipo: 'evento'; evento: EventoHistorialApi }
  | { tipo: 'grupo'; eventos: EventoHistorialApi[] }

// Colapsa rachas consecutivas del MISMO nombreArchivo (ver PanelHistorialMediciones):
// abrir A, cancelar A, abrir B, cancelar B, volver a abrir A → 3 items
// (racha de A, racha de B, racha de A de nuevo), no 1 solo — un archivo
// distinto en el medio corta la racha aunque el nombre se repita después.
// Eventos sin nombreArchivo (ficha_creada_manual) nunca agrupan entre sí.
function agruparPorArchivo(eventos: EventoHistorialApi[]): ItemHistorial[] {
  const items: ItemHistorial[] = []
  let i = 0
  while (i < eventos.length) {
    const actual = eventos[i]
    if (!actual.nombreArchivo) {
      items.push({ tipo: 'evento', evento: actual })
      i++
      continue
    }
    let j = i + 1
    while (j < eventos.length && eventos[j].nombreArchivo === actual.nombreArchivo) j++
    const racha = eventos.slice(i, j)
    items.push(racha.length > 1 ? { tipo: 'grupo', eventos: racha } : { tipo: 'evento', evento: actual })
    i = j
  }
  return items
}

// Card de historial GLOBAL (todos los trenes, un solo feed) de eventos de
// carga de mediciones — vive siempre montada en Nuevas Mediciones (con o sin
// ficha abierta), a diferencia del resto de la página que depende de
// fichaId/tren. Ver NewMeasurementHistoryService (backend) para qué eventos
// se registran.
export function PanelHistorialMediciones({
  motivo = 'Medición',
}: {
  motivo?: MotivoFicha
}) {
  const historial = useHistorialMediciones(undefined, motivo)
  const esReperfilado = motivo === 'Reperfilado'
  const textoPorTipo = esReperfilado ? TEXTO_REPERFILADO_POR_TIPO : TEXTO_MEDICION_POR_TIPO

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h2 className="mb-3 font-display text-sm font-semibold text-concreto-oscuro">
        {esReperfilado ? 'Historial de reperfilados' : 'Historial de mediciones'}
      </h2>

      {historial.isLoading ? (
        <p className="font-body text-xs text-concreto">Cargando…</p>
      ) : historial.isError ? (
        <p role="alert" className="font-body text-xs text-[color:var(--color-estado-critico)]">
          {extraerMensajeError(historial.error)}
        </p>
      ) : !historial.data || historial.data.length === 0 ? (
        <p className="font-body text-xs text-concreto">
          {esReperfilado
            ? 'Todavía no hay reperfilados registrados.'
            : 'Todavía no hay eventos registrados.'}
        </p>
      ) : (
        <ScrollArea viewportClassName="max-h-[32rem]">
          <ul>
            {agruparPorArchivo(historial.data).map((item) =>
              item.tipo === 'grupo' ? (
                <FilaGrupo key={item.eventos[0].id} grupo={item.eventos} textoPorTipo={textoPorTipo} />
              ) : (
                <FilaEvento key={item.evento.id} evento={item.evento} textoPorTipo={textoPorTipo} />
              ),
            )}
          </ul>
        </ScrollArea>
      )}
    </GlassSurface>
  )
}
