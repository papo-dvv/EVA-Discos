import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import { construirFilasEspejo, type FilaEspejo, type LadoFilaEspejo } from '../filaEspejo'
import type { PosicionEsqueleto, PreviewRow } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  deshabilitada?: boolean
}

// Tabla espejo de la ficha (punto 2c): 24 filas, una por eje, con el bloque
// izquierdo y derecho reflejados hacia el Coche central. Editable inline
// (Observación, Espesor T, Desgaste H) — mismo patrón de edición por fila que
// la vista previa de migración (TablaScanRecords + acciones inline), pero acá
// cada celda se guarda sola al perder el foco en vez de abrir un modal: con
// hasta 48 valores por ficha, un modal por celda sería impracticable. Rd
// (Vida Útil) nunca es editable: siempre lo calcula el backend.
export function TablaFichaEspejo({ fichaId, esqueleto, rows, deshabilitada = false }: Props) {
  const filas = useMemo(() => construirFilasEspejo(esqueleto, rows), [esqueleto, rows])

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <ScrollArea ejes="both" viewportClassName="max-h-[32rem]">
        <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
          <thead>
            <tr className="border-b border-concreto/20">
              <th
                colSpan={7}
                className="sticky top-0 z-[1] bg-[color:var(--color-arena-suave)] px-3 py-1.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto"
              >
                Izquierdo
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-[1] bg-[color:var(--color-arena-suave)] px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-concreto"
              >
                Coche
              </th>
              <th
                colSpan={6}
                className="sticky top-0 z-[1] bg-[color:var(--color-arena-suave)] px-3 py-1.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto"
              >
                Derecho
              </th>
            </tr>
            <tr className="border-b border-concreto/20">
              <Encabezado>Bogie/Código</Encabezado>
              <Encabezado>Observación</Encabezado>
              <Encabezado mono>Vida útil (T-H)</Encabezado>
              <Encabezado mono>Espesor (T)</Encabezado>
              <Encabezado mono>Desgaste (H)</Encabezado>
              <Encabezado mono>Eje</Encabezado>
              <Encabezado mono>Rueda</Encabezado>
              <Encabezado mono>Rueda</Encabezado>
              <Encabezado mono>Eje</Encabezado>
              <Encabezado mono>Desgaste (H)</Encabezado>
              <Encabezado mono>Espesor (T)</Encabezado>
              <Encabezado mono>Vida útil</Encabezado>
              <Encabezado>Observación</Encabezado>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <FilaEspejoRow key={fila.ejeNumero} fichaId={fichaId} fila={fila} deshabilitada={deshabilitada} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </GlassSurface>
  )
}

function Encabezado({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <th
      className={`sticky top-[1.9375rem] z-[1] whitespace-nowrap bg-[color:var(--color-arena-suave)] px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto ${
        mono ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Celda({
  children,
  mono = false,
  className = '',
}: {
  children: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <td
      className={`whitespace-nowrap px-2.5 py-1.5 text-concreto-oscuro ${mono ? 'text-right font-data' : ''} ${className}`.trim()}
    >
      {children}
    </td>
  )
}

// Coordina, para UN lado (izquierdo o derecho) de UN eje, el borrador local
// de T/H/Observación y decide si cada edición dispara un PATCH (la fila ya
// existe como scan_record) o un POST (todavía no existe: el backend exige T
// Y H juntos para crearla — ver AgregarFilaDto — así que un POST solo se
// dispara cuando ambos ya están presentes en el borrador). UNA sola instancia
// por lado (llamado desde FilaEspejoRow, no desde cada celda) — así las 3
// celdas editables de ese lado comparten el mismo borrador en vez de 3 copias
// aisladas que nunca se enterarían la una de la otra.
function useLadoEditable(fichaId: string, eje: number, lado: Lado, datos: LadoFilaEspejo) {
  const agregar = useAgregarFilaFicha(fichaId)
  const editar = useEditarFilaFicha(fichaId)

  const [tValue, setTValue] = useSyncedState(datos.tValue)
  const [hValue, setHValue] = useSyncedState(datos.hValue)
  const [observacion, setObservacion] = useSyncedState(datos.observacion ?? '')

  function intentarCrear(t: number | null, h: number | null, obs: string) {
    if (datos.recordId || t === null || h === null) return
    agregar.mutate({ ejeNumero: eje, lado, tValue: t, hValue: h, observacion: obs || undefined })
  }

  function guardarT(n: number) {
    setTValue(n)
    if (datos.recordId) editar.mutate({ recordId: datos.recordId, cambios: { tValue: n } })
    else intentarCrear(n, hValue, observacion)
  }
  function guardarH(n: number) {
    setHValue(n)
    if (datos.recordId) editar.mutate({ recordId: datos.recordId, cambios: { hValue: n } })
    else intentarCrear(tValue, n, observacion)
  }
  function guardarObservacion(s: string) {
    setObservacion(s)
    if (datos.recordId) editar.mutate({ recordId: datos.recordId, cambios: { observacion: s } })
    else intentarCrear(tValue, hValue, s)
  }

  const pendiente = !datos.recordId && (tValue !== null || hValue !== null) && (tValue === null || hValue === null)

  return { tValue, hValue, observacion, guardarT, guardarH, guardarObservacion, pendiente }
}

function FilaEspejoRow({
  fichaId,
  fila,
  deshabilitada,
}: {
  fichaId: string
  fila: FilaEspejo
  deshabilitada: boolean
}) {
  const izq = useLadoEditable(fichaId, fila.ejeNumero, 'izquierdo', fila.izquierdo)
  const der = useLadoEditable(fichaId, fila.ejeNumero, 'derecho', fila.derecho)

  return (
    <tr className="tabla-fila--glass border-b border-concreto/10">
      <Celda>{fila.bogieCodigo}</Celda>
      <CampoTexto valor={izq.observacion} onGuardar={izq.guardarObservacion} deshabilitada={deshabilitada} />
      <Celda mono>{fila.izquierdo.rdValue !== null ? fila.izquierdo.rdValue.toFixed(2) : '—'}</Celda>
      <CampoNumero valor={izq.tValue} onGuardar={izq.guardarT} deshabilitada={deshabilitada} />
      <CampoNumero
        valor={izq.hValue}
        onGuardar={izq.guardarH}
        deshabilitada={deshabilitada}
        pendiente={izq.pendiente}
      />
      <Celda mono>{fila.ejeNumero}</Celda>
      <Celda mono>{fila.izquierdo.ruedaNumero}</Celda>

      <Celda className="bg-white/40 text-center font-semibold">
        {fila.tipoCoche}
        {fila.numeroCoche !== null && <span className="text-concreto"> · {fila.numeroCoche}</span>}
      </Celda>

      <Celda mono>{fila.derecho.ruedaNumero}</Celda>
      <Celda mono>{fila.ejeNumero}</Celda>
      <CampoNumero
        valor={der.hValue}
        onGuardar={der.guardarH}
        deshabilitada={deshabilitada}
        pendiente={der.pendiente}
      />
      <CampoNumero valor={der.tValue} onGuardar={der.guardarT} deshabilitada={deshabilitada} />
      <Celda mono>{fila.derecho.rdValue !== null ? fila.derecho.rdValue.toFixed(2) : '—'}</Celda>
      <CampoTexto valor={der.observacion} onGuardar={der.guardarObservacion} deshabilitada={deshabilitada} />
    </tr>
  )
}

function CampoNumero({
  valor,
  onGuardar,
  deshabilitada,
  pendiente = false,
}: {
  valor: number | null
  onGuardar: (n: number) => void
  deshabilitada: boolean
  pendiente?: boolean
}) {
  const [borrador, setBorrador] = useSyncedState(valor === null ? '' : String(valor))

  return (
    <td className="whitespace-nowrap px-1 py-1 text-right">
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          step="any"
          disabled={deshabilitada}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={() => {
            const n = Number(borrador)
            if (borrador.trim() !== '' && Number.isFinite(n) && n !== valor) onGuardar(n)
          }}
          placeholder="—"
          className="w-16 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-right font-data text-xs text-concreto-oscuro transition-colors hover:border-concreto/25 focus:border-verde-institucional focus:bg-white/70 focus:outline-none disabled:opacity-50"
        />
        {pendiente && (
          <WarningTooltip texto="Completa Espesor (T) y Desgaste (H) para guardar esta fila.">⚠️</WarningTooltip>
        )}
      </span>
    </td>
  )
}

function CampoTexto({
  valor,
  onGuardar,
  deshabilitada,
}: {
  valor: string
  onGuardar: (s: string) => void
  deshabilitada: boolean
}) {
  const [borrador, setBorrador] = useSyncedState(valor)

  return (
    <td className="px-1 py-1">
      <input
        type="text"
        disabled={deshabilitada}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => {
          if (borrador !== valor) onGuardar(borrador)
        }}
        placeholder="—"
        className="w-32 rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-body text-xs text-concreto-oscuro transition-colors hover:border-concreto/25 focus:border-verde-institucional focus:bg-white/70 focus:outline-none disabled:opacity-50"
      />
    </td>
  )
}
