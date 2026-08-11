import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import { construirFilasEspejo, type FilaEspejo, type LadoFilaEspejo } from '../filaEspejo'
import type { ValorPrevioDisco } from '../referenciaAnterior'
import type { PosicionEsqueleto, PreviewRow } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  deshabilitada?: boolean
  // Última medición confirmada de cada disco del tren (ver
  // construirMapaReferenciaPorEjeLado) — permite que la alerta de tInvalido/
  // rdInvalido (punto 1) muestre el valor previo exacto. undefined en la
  // tabla de solo-lectura del modal "Medición Anterior" (ahí no hay alertas
  // que mostrar: son datos ya confirmados, nunca marcados inválidos).
  referenciaPorEjeLado?: Map<string, ValorPrevioDisco>
}

// Tabla espejo de la ficha (punto 2c): 24 filas, una por eje, con el bloque
// izquierdo y derecho reflejados hacia el Coche central. Editable inline
// (Observación, Espesor T, Desgaste H) — mismo patrón de edición por fila que
// la vista previa de migración (TablaScanRecords + acciones inline), pero acá
// cada celda se guarda sola al perder el foco en vez de abrir un modal: con
// hasta 48 valores por ficha, un modal por celda sería impracticable. Rd
// (Vida Útil) nunca es editable: siempre lo calcula el backend.
export function TablaFichaEspejo({
  fichaId,
  esqueleto,
  rows,
  deshabilitada = false,
  referenciaPorEjeLado,
}: Props) {
  const filas = useMemo(() => construirFilasEspejo(esqueleto, rows), [esqueleto, rows])

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <ScrollArea ejes="both" viewportClassName="max-h-[32rem]">
        <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
          <thead>
            <tr className="border-b border-concreto/20">
              <th
                rowSpan={2}
                aria-label="Alertas del lado izquierdo"
                className="sticky top-0 z-[1] w-8 bg-[color:var(--color-arena-suave)] px-1 py-1.5 text-center text-xs text-concreto"
              >
                ⚠
              </th>
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
              <th
                rowSpan={2}
                aria-label="Alertas del lado derecho"
                className="sticky top-0 z-[1] w-8 bg-[color:var(--color-arena-suave)] px-1 py-1.5 text-center text-xs text-concreto"
              >
                ⚠
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
              <FilaEspejoRow
                key={fila.ejeNumero}
                fichaId={fichaId}
                fila={fila}
                deshabilitada={deshabilitada}
                referenciaPorEjeLado={referenciaPorEjeLado}
              />
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

// Texto de la alerta de UN lado (izquierdo o derecho) — combina tInvalido y
// rdInvalido si ambos aplican, y muestra el valor previo exacto cuando hay
// referencia disponible (ver referenciaAnterior.ts); si no hay referencia
// para este eje+lado (ej. disco recién agregado al catálogo, sin historial),
// cae a un mensaje sin el valor previo — nunca deja de avisar.
function textoAlertaLado(lado: LadoFilaEspejo, previo: ValorPrevioDisco | undefined): string {
  const partes: string[] = []
  if (lado.tInvalido) {
    partes.push(
      previo
        ? `Espesor (T) actual (${lado.tValue}) es mayor al último confirmado de este disco (${previo.tValue}).`
        : 'Espesor (T) actual es mayor al último confirmado de este disco.',
    )
  }
  if (lado.rdInvalido) {
    partes.push(
      previo
        ? `Vida útil (Rd) actual (${lado.rdValue?.toFixed(2)}) es mayor a la última confirmada de este disco (${previo.rdValue.toFixed(2)}).`
        : 'Vida útil (Rd) actual es mayor a la última confirmada de este disco.',
    )
  }
  if (lado.excluidaDelCommit) {
    partes.push('Esta fila quedó excluida del commit: no se guardará hasta que se corrija y se vuelva a verificar.')
  }
  return partes.join(' ')
}

function CeldaAlertaLado({
  lado,
  previo,
}: {
  lado: LadoFilaEspejo
  previo: ValorPrevioDisco | undefined
}) {
  const hayAlerta = lado.tInvalido || lado.rdInvalido || lado.excluidaDelCommit
  return (
    <td className="px-1 py-1.5 text-center">
      {hayAlerta && (
        <WarningTooltip texto={textoAlertaLado(lado, previo)}>
          <span aria-hidden className="text-sm text-[color:var(--color-estado-critico)]">
            ⚠️
          </span>
        </WarningTooltip>
      )}
    </td>
  )
}

// Clase de atenuación de la fila cuando quedó excluida del commit (punto 2:
// "fila atenuada") — se aplica SOLO a las celdas del lado excluido, ya que
// izquierdo/derecho son discos independientes y uno puede quedar excluido
// sin el otro.
function claseExcluida(excluidaDelCommit: boolean): string {
  return excluidaDelCommit ? 'opacity-45' : ''
}

function BadgeExcluida() {
  return (
    <span className="ml-1 rounded-full bg-[color:var(--color-estado-critico)]/15 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[color:var(--color-estado-critico)]">
      Excluida
    </span>
  )
}

function FilaEspejoRow({
  fichaId,
  fila,
  deshabilitada,
  referenciaPorEjeLado,
}: {
  fichaId: string
  fila: FilaEspejo
  deshabilitada: boolean
  referenciaPorEjeLado?: Map<string, ValorPrevioDisco>
}) {
  const izq = useLadoEditable(fichaId, fila.ejeNumero, 'izquierdo', fila.izquierdo)
  const der = useLadoEditable(fichaId, fila.ejeNumero, 'derecho', fila.derecho)
  const previoIzq = referenciaPorEjeLado?.get(`${fila.ejeNumero}|izquierdo`)
  const previoDer = referenciaPorEjeLado?.get(`${fila.ejeNumero}|derecho`)
  const claseIzq = claseExcluida(fila.izquierdo.excluidaDelCommit)
  const claseDer = claseExcluida(fila.derecho.excluidaDelCommit)

  return (
    <tr className="tabla-fila--glass border-b border-concreto/10">
      <CeldaAlertaLado lado={fila.izquierdo} previo={previoIzq} />

      <Celda className={claseIzq}>
        {fila.bogieCodigo}
        {fila.izquierdo.excluidaDelCommit && <BadgeExcluida />}
      </Celda>
      <CampoTexto
        valor={izq.observacion}
        onGuardar={izq.guardarObservacion}
        deshabilitada={deshabilitada}
        className={claseIzq}
      />
      <Celda mono className={claseIzq}>
        {fila.izquierdo.rdValue !== null ? fila.izquierdo.rdValue.toFixed(2) : '—'}
      </Celda>
      <CampoNumero
        valor={izq.tValue}
        onGuardar={izq.guardarT}
        deshabilitada={deshabilitada}
        className={claseIzq}
      />
      <CampoNumero
        valor={izq.hValue}
        onGuardar={izq.guardarH}
        deshabilitada={deshabilitada}
        pendiente={izq.pendiente}
        className={claseIzq}
      />
      <Celda mono className={claseIzq}>
        {fila.ejeNumero}
      </Celda>
      <Celda mono className={claseIzq}>
        {fila.izquierdo.ruedaNumero}
      </Celda>

      <Celda className="bg-white/40 text-center font-semibold">
        {fila.tipoCoche}
        {fila.numeroCoche !== null && <span className="text-concreto"> · {fila.numeroCoche}</span>}
      </Celda>

      <Celda mono className={claseDer}>
        {fila.derecho.ruedaNumero}
      </Celda>
      <Celda mono className={claseDer}>
        {fila.ejeNumero}
      </Celda>
      <CampoNumero
        valor={der.hValue}
        onGuardar={der.guardarH}
        deshabilitada={deshabilitada}
        pendiente={der.pendiente}
        className={claseDer}
      />
      <CampoNumero
        valor={der.tValue}
        onGuardar={der.guardarT}
        deshabilitada={deshabilitada}
        className={claseDer}
      />
      <Celda mono className={claseDer}>
        {fila.derecho.rdValue !== null ? fila.derecho.rdValue.toFixed(2) : '—'}
      </Celda>
      <CampoTexto
        valor={der.observacion}
        onGuardar={der.guardarObservacion}
        deshabilitada={deshabilitada}
        className={claseDer}
      >
        {fila.derecho.excluidaDelCommit && <BadgeExcluida />}
      </CampoTexto>

      <CeldaAlertaLado lado={fila.derecho} previo={previoDer} />
    </tr>
  )
}

function CampoNumero({
  valor,
  onGuardar,
  deshabilitada,
  pendiente = false,
  className = '',
}: {
  valor: number | null
  onGuardar: (n: number) => void
  deshabilitada: boolean
  pendiente?: boolean
  className?: string
}) {
  const [borrador, setBorrador] = useSyncedState(valor === null ? '' : String(valor))

  return (
    <td className={`whitespace-nowrap px-1 py-1 text-right ${className}`.trim()}>
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
  className = '',
  children,
}: {
  valor: string
  onGuardar: (s: string) => void
  deshabilitada: boolean
  className?: string
  children?: ReactNode
}) {
  const [borrador, setBorrador] = useSyncedState(valor)

  return (
    <td className={`px-1 py-1 ${className}`.trim()}>
      <span className="inline-flex items-center">
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
        {children}
      </span>
    </td>
  )
}
