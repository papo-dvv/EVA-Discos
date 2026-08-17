import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import { construirFilasEspejo, type FilaEspejo, type LadoFilaEspejo } from '../filaEspejo'
import type { CampoInvalido, EstadoDisco, MotivoInvalido, PosicionEsqueleto, PreviewRow } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  deshabilitada?: boolean
  // true recién después de que el usuario presionó "Verificar" al menos una
  // vez (ver NuevasMediciones.tsx: se activa con la response de POST
  // .../validate y NO se apaga al cerrar el modal — solo lo reemplaza una
  // nueva verificación). Activa 2 efectos juntos: reordena las filas con
  // algún motivo primero y agrega la columna "Motivo/Inválido" (si
  // corresponde), resaltando la celda de cada campo marcado inválido. false
  // por defecto: nunca se activa en la tabla de solo-lectura de "Medición
  // Anterior" (esa nunca pasa por /validate).
  resaltarInvalidos?: boolean
}

// Tabla espejo de la ficha (punto 2c): 24 filas, una por eje, con el bloque
// izquierdo y derecho reflejados hacia el Coche central. Editable inline
// (Espesor T, Desgaste H) — mismo patrón de edición por fila que la vista
// previa de migración (TablaScanRecords + acciones inline), pero acá cada
// celda se guarda sola al perder el foco en vez de abrir un modal: con hasta
// 48 valores por ficha, un modal por celda sería impracticable. Rd (Vida
// Útil) nunca es editable: siempre lo calcula el backend, igual que Estado
// (columna "Observación": SIEMPRE un chip de solo lectura con
// estadoCalculado — nunca un input de texto, ver CeldaEstado).
export function TablaFichaEspejo({
  fichaId,
  esqueleto,
  rows,
  deshabilitada = false,
  resaltarInvalidos = false,
}: Props) {
  const filasBase = useMemo(() => construirFilasEspejo(esqueleto, rows), [esqueleto, rows])

  // Invalidas primero (mismo orden eje ASC ya usado en filasBase, solo
  // particionado), válidas después en su orden habitual — ver punto 3 del
  // enunciado. Partición estable: filasBase ya viene eje ASC, así que cada
  // mitad conserva ese orden.
  const filas = useMemo(() => {
    if (!resaltarInvalidos) return filasBase
    const invalidas = filasBase.filter((f) => hayMotivo(f.izquierdo) || hayMotivo(f.derecho))
    const validas = filasBase.filter((f) => !hayMotivo(f.izquierdo) && !hayMotivo(f.derecho))
    return [...invalidas, ...validas]
  }, [filasBase, resaltarInvalidos])

  const mostrarColumnaMotivo =
    resaltarInvalidos && filas.some((f) => hayMotivo(f.izquierdo) || hayMotivo(f.derecho))

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div>
        <table className="w-full table-fixed border-collapse text-left font-body text-[0.75rem]">
          <thead>
            <tr className="border-b border-concreto/20">
              {mostrarColumnaMotivo && (
                <th
                  rowSpan={2}
                  className="sticky top-0 z-[1] w-[12rem] bg-[color:var(--color-arena-suave)] px-2 py-1.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto"
                >
                  Motivo/Inválido
                </th>
              )}
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
              <Encabezado>Estado</Encabezado>
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
              <Encabezado>Estado</Encabezado>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <FilaEspejoRow
                key={fila.ejeNumero}
                fichaId={fichaId}
                fila={fila}
                deshabilitada={deshabilitada}
                resaltarInvalidos={resaltarInvalidos}
                mostrarColumnaMotivo={mostrarColumnaMotivo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </GlassSurface>
  )
}

function hayMotivo(lado: LadoFilaEspejo): boolean {
  return lado.motivos.length > 0
}

function tieneMotivo(motivos: MotivoInvalido[], campo: CampoInvalido): boolean {
  return motivos.some((m) => m.campo === campo)
}

// Combina los motivos de ambos lados de un eje en un solo texto para la
// columna "Motivo/Inválido" (una fila de esta tabla = un eje, con 2 discos
// independientes) — prefijado por lado solo cuando hace falta desambiguar.
function textoMotivosFila(fila: FilaEspejo): string {
  const partes: string[] = []
  if (fila.izquierdo.motivos.length > 0) {
    partes.push(`Izq: ${fila.izquierdo.motivos.map((m) => m.motivo).join('; ')}`)
  }
  if (fila.derecho.motivos.length > 0) {
    partes.push(`Der: ${fila.derecho.motivos.map((m) => m.motivo).join('; ')}`)
  }
  return partes.join(' — ')
}

function Encabezado({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <th
      className={`sticky top-[1.9375rem] z-[1] break-words bg-[color:var(--color-arena-suave)] px-1 py-2 text-[0.6875rem] font-semibold uppercase leading-tight tracking-wide text-concreto ${
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
      className={`overflow-hidden px-1 py-1 text-concreto-oscuro ${mono ? 'text-right font-data' : ''} ${className}`.trim()}
    >
      {children}
    </td>
  )
}

// Coordina, para UN lado (izquierdo o derecho) de UN eje, el borrador local
// de T/H y decide si cada edición dispara un PATCH (la fila ya existe como
// scan_record) o un POST (todavía no existe: el backend exige T Y H juntos
// para crearla — ver AgregarFilaDto — así que un POST solo se dispara cuando
// ambos ya están presentes en el borrador). UNA sola instancia por lado
// (llamado desde FilaEspejoRow, no desde cada celda) — así las 2 celdas
// editables de ese lado comparten el mismo borrador en vez de 2 copias
// aisladas que nunca se enterarían la una de la otra.
function useLadoEditable(fichaId: string, eje: number, lado: Lado, datos: LadoFilaEspejo) {
  const agregar = useAgregarFilaFicha(fichaId)
  const editar = useEditarFilaFicha(fichaId)

  const [tValue, setTValue] = useSyncedState(datos.tValue)
  const [hValue, setHValue] = useSyncedState(datos.hValue)

  function intentarCrear(t: number | null, h: number | null) {
    if (datos.recordId || t === null || h === null) return
    agregar.mutate({ ejeNumero: eje, lado, tValue: t, hValue: h })
  }

  function guardarT(n: number) {
    setTValue(n)
    if (datos.recordId) editar.mutate({ recordId: datos.recordId, cambios: { tValue: n } })
    else intentarCrear(n, hValue)
  }
  function guardarH(n: number) {
    setHValue(n)
    if (datos.recordId) editar.mutate({ recordId: datos.recordId, cambios: { hValue: n } })
    else intentarCrear(tValue, n)
  }

  const pendiente = !datos.recordId && (tValue !== null || hValue !== null) && (tValue === null || hValue === null)

  return { tValue, hValue, guardarT, guardarH, pendiente }
}

// Punto 3 del enunciado: ámbar — el valor es válido de formato, solo quedó
// marcado por la validación cruzada contra el historial. Ring en vez de
// border: no desplaza el layout de la celda al aparecer/desaparecer.
const CLASE_RESALTADO =
  'ring-1 ring-inset ring-[color:var(--color-estado-seguimiento)] bg-[color:var(--color-estado-seguimiento)]/10 rounded-lg'

function FilaEspejoRow({
  fichaId,
  fila,
  deshabilitada,
  resaltarInvalidos,
  mostrarColumnaMotivo,
}: {
  fichaId: string
  fila: FilaEspejo
  deshabilitada: boolean
  resaltarInvalidos: boolean
  mostrarColumnaMotivo: boolean
}) {
  const izq = useLadoEditable(fichaId, fila.ejeNumero, 'izquierdo', fila.izquierdo)
  const der = useLadoEditable(fichaId, fila.ejeNumero, 'derecho', fila.derecho)
  const resaltarTIzq = resaltarInvalidos && tieneMotivo(fila.izquierdo.motivos, 't')
  const resaltarRdIzq = resaltarInvalidos && tieneMotivo(fila.izquierdo.motivos, 'rd')
  const resaltarTDer = resaltarInvalidos && tieneMotivo(fila.derecho.motivos, 't')
  const resaltarRdDer = resaltarInvalidos && tieneMotivo(fila.derecho.motivos, 'rd')

  return (
    <tr className="tabla-fila--glass border-b border-concreto/10">
      {mostrarColumnaMotivo && (
        <td className="w-[12rem] break-words px-2 py-1.5 align-top">
          {hayMotivo(fila.izquierdo) || hayMotivo(fila.derecho) ? (
            <WarningTooltip texto={textoMotivosFila(fila)} className="block">
              <span className="block cursor-help whitespace-normal text-pretty font-body text-xs font-semibold leading-snug text-[color:var(--color-estado-critico)]">
                ⚠ {textoMotivosFila(fila)}
              </span>
            </WarningTooltip>
          ) : (
            <span className="font-body text-xs text-concreto">—</span>
          )}
        </td>
      )}

      <Celda>{fila.bogieCodigo}</Celda>
      <CeldaEstado estado={fila.izquierdo.estadoCalculado} />
      <Celda mono className={resaltarRdIzq ? CLASE_RESALTADO : ''}>
        {fila.izquierdo.rdValue !== null ? fila.izquierdo.rdValue.toFixed(2) : '—'}
      </Celda>
      <CampoNumero
        valor={izq.tValue}
        onGuardar={izq.guardarT}
        deshabilitada={deshabilitada}
        resaltado={resaltarTIzq}
      />
      <CampoNumero valor={izq.hValue} onGuardar={izq.guardarH} deshabilitada={deshabilitada} pendiente={izq.pendiente} />
      <Celda mono className="w-9">{fila.ejeNumero}</Celda>
      <Celda mono className="w-9">{fila.izquierdo.ruedaNumero}</Celda>

      <Celda className="bg-white/40 text-center font-semibold">
        {fila.tipoCoche}
        {fila.numeroCoche !== null && <span className="text-concreto"> · {fila.numeroCoche}</span>}
      </Celda>

      <Celda mono className="w-9">{fila.derecho.ruedaNumero}</Celda>
      <Celda mono className="w-9">{fila.ejeNumero}</Celda>
      <CampoNumero
        valor={der.hValue}
        onGuardar={der.guardarH}
        deshabilitada={deshabilitada}
        pendiente={der.pendiente}
      />
      <CampoNumero
        valor={der.tValue}
        onGuardar={der.guardarT}
        deshabilitada={deshabilitada}
        resaltado={resaltarTDer}
      />
      <Celda mono className={resaltarRdDer ? CLASE_RESALTADO : ''}>
        {fila.derecho.rdValue !== null ? fila.derecho.rdValue.toFixed(2) : '—'}
      </Celda>
      <CeldaEstado estado={fila.derecho.estadoCalculado} />
    </tr>
  )
}

// Mismas clases .tabla-chip/.tabla-chip--{estado} ya usadas en Migración/
// Mediciones (ver EstadoChip en features/scan-records/components/TablaScanRecords.tsx)
// — mismo componente visual, reimplementado acá porque cada tabla define el
// suyo (convención ya establecida, ver comentario homólogo en TablaProyeccion.tsx).
const CLASE_CHIP_ESTADO: Record<EstadoDisco, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

// Punto 1 del enunciado: la columna "Observación" ya NO es un input de texto
// libre — es un chip de solo lectura con el estado calculado del disco
// (estadoCalculado, siempre recalculado por el backend a partir de T/H, ver
// BrakeDiscRulesEngine.clasificarEstadoConReperfilado). Sin fila creada
// todavía (T/H incompletos) no hay estado que mostrar.
function CeldaEstado({ estado }: { estado: EstadoDisco | null }) {
  return (
    <td className="whitespace-nowrap px-2 py-1">
      {estado ? (
        <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>{estado}</span>
      ) : (
        <span className="font-body text-xs text-concreto">—</span>
      )}
    </td>
  )
}

function CampoNumero({
  valor,
  onGuardar,
  deshabilitada,
  pendiente = false,
  resaltado = false,
}: {
  valor: number | null
  onGuardar: (n: number) => void
  deshabilitada: boolean
  pendiente?: boolean
  resaltado?: boolean
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
          className={`w-full min-w-0 border px-1 py-1 text-right font-data text-xs text-concreto-oscuro transition-colors hover:border-concreto/25 focus:border-verde-institucional focus:bg-white/70 focus:outline-none disabled:opacity-50 ${
            resaltado ? CLASE_RESALTADO : 'rounded-lg border-transparent bg-transparent'
          }`.trim()}
        />
        {pendiente && (
          <WarningTooltip texto="Completa Espesor (T) y Desgaste (H) para guardar esta fila.">⚠️</WarningTooltip>
        )}
      </span>
    </td>
  )
}
