import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import {
  claveCocheDe,
  construirFilasEspejo,
  ordenarPorVerificacionPorCoche,
  type FilaEspejo,
  type LadoFilaEspejo,
} from '../filaEspejo'
import { useLadoEditable } from '../useLadoEditable'
import type {
  CampoInvalido,
  CodigosBogie,
  EstadoDisco,
  FilaExcluidaVerificacion,
  MotivoInvalido,
  PosicionEsqueleto,
  PreviewRow,
} from '../types'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  codigosBogie?: CodigosBogie | null
  deshabilitada?: boolean
  // Si está definido, la celda de Coche (rowSpan por grupo) muestra un botón
  // "Comparar" que llama esto con el tipoCoche/numeroCoche de ese grupo —
  // ausente en la tabla de solo lectura de ModalMedicionAnterior.tsx (no
  // tiene sentido comparar "contra sí misma"), definido solo en la instancia
  // principal de NuevasMediciones.tsx.
  onComparar?: (tipoCoche: string, numeroCoche: number | null) => void
  // true recién después de que el usuario presionó "Verificar" al menos una
  // vez (ver NuevasMediciones.tsx: se activa con la response de POST
  // .../validate y NO se apaga al cerrar el modal — solo lo reemplaza una
  // nueva verificación). Activa 2 efectos juntos: reordena las filas con
  // algún motivo primero y agrega la columna "Motivo/Inválido" (si
  // corresponde), resaltando la celda de cada campo marcado inválido. false
  // por defecto: nunca se activa en la tabla de solo-lectura de "Medición
  // Anterior" (esa nunca pasa por /validate).
  resaltarInvalidos?: boolean
  filasExcluidasVerificacion?: FilaExcluidaVerificacion[]
}

type LadoMotivo = LadoFilaEspejo & {
  motivosVisibles: MotivoInvalido[]
}

type FilaEspejoVisible = Omit<FilaEspejo, 'izquierdo' | 'derecho'> & {
  izquierdo: LadoMotivo
  derecho: LadoMotivo
}

type FilaRender = FilaEspejoVisible & {
  mostrarCoche: boolean
  cocheRowSpan: number
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
  codigosBogie = null,
  deshabilitada = false,
  resaltarInvalidos = false,
  filasExcluidasVerificacion = [],
  onComparar,
}: Props) {
  const filasBase = useMemo(
    () => construirFilasEspejo(esqueleto, rows),
    [esqueleto, rows],
  )
  const motivosVerificadosPorRecord = useMemo(() => {
    const mapa = new Map<string, MotivoInvalido[]>()
    for (const fila of filasExcluidasVerificacion) {
      mapa.set(fila.recordId, fila.motivos)
    }
    return mapa
  }, [filasExcluidasVerificacion])

  const filasConMotivos = useMemo(
    () =>
      filasBase.map((fila): FilaEspejoVisible => ({
        ...fila,
        izquierdo: {
          ...fila.izquierdo,
          motivosVisibles:
            (fila.izquierdo.recordId
              ? motivosVerificadosPorRecord.get(fila.izquierdo.recordId)
              : undefined) ?? fila.izquierdo.motivos,
        },
        derecho: {
          ...fila.derecho,
          motivosVisibles:
            (fila.derecho.recordId
              ? motivosVerificadosPorRecord.get(fila.derecho.recordId)
              : undefined) ?? fila.derecho.motivos,
        },
      })),
    [filasBase, motivosVerificadosPorRecord],
  )

  // Invalidas primero, válidas después — pero ACOTADO a cada coche (ver
  // ordenarPorVerificacionPorCoche en filaEspejo.ts): un eje con error nunca
  // sube por encima de otro coche, solo por encima de los ejes SIN error de
  // su propio coche. filasConMotivos ya viene con los coches contiguos
  // (mismo orden eje ASC de filasBase), condición que asume la función.
  const filas = useMemo(() => {
    if (!resaltarInvalidos) return filasConMotivos
    return ordenarPorVerificacionPorCoche(
      filasConMotivos,
      (f) => hayMotivoVisible(f.izquierdo) || hayMotivoVisible(f.derecho),
    )
  }, [filasConMotivos, resaltarInvalidos])

  const filasRender = useMemo(() => calcularRowSpanCoche(filas), [filas])

  const mostrarColumnaMotivo =
    resaltarInvalidos &&
    filas.some(
      (f) => hayMotivoVisible(f.izquierdo) || hayMotivoVisible(f.derecho),
    )

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div>
        {/* +2pt sobre los 12px (9pt) originales — pedido explícito para mejorar la lectura de mediciones/estado */}
        <table className="w-full table-fixed border-collapse text-left font-body text-[0.9167rem]">
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
            {filasRender.map((fila) => (
              <FilaEspejoRow
                key={fila.ejeNumero}
                fichaId={fichaId}
                fila={fila}
                deshabilitada={deshabilitada}
                resaltarInvalidos={resaltarInvalidos}
                mostrarColumnaMotivo={mostrarColumnaMotivo}
                codigosBogie={codigosBogie}
                onComparar={onComparar}
              />
            ))}
          </tbody>
        </table>
      </div>
    </GlassSurface>
  )
}

function hayMotivoVisible(lado: LadoMotivo): boolean {
  return lado.motivosVisibles.length > 0
}

function tieneMotivo(motivos: MotivoInvalido[], campo: CampoInvalido): boolean {
  return motivos.some((m) => m.campo === campo)
}

function motivoCorregido(datos: LadoMotivo, campo: CampoInvalido): boolean {
  if (campo === 't') return !datos.tInvalido
  if (campo === 'rd') return !datos.rdInvalido
  return false
}

function MotivosLado({
  lado,
  datos,
}: {
  lado: 'Izq' | 'Der'
  datos: LadoMotivo
}) {
  if (datos.motivosVisibles.length === 0) return null

  return (
    <span className="block">
      <span className="font-semibold">{lado}: </span>
      {datos.motivosVisibles.map((motivo, indice) => {
        const corregido = motivoCorregido(datos, motivo.campo)
        return (
          <span
            key={`${motivo.campo}-${indice}`}
            className={
              corregido
                ? 'motivo-invalido--corregido font-medium italic text-concreto'
                : 'font-semibold text-[color:var(--color-estado-critico)]'
            }
          >
            {indice > 0 ? '; ' : ''}
            {motivo.motivo}
          </span>
        )
      })}
    </span>
  )
}

// Combina los motivos de ambos lados de un eje en un solo texto para la
// columna "Motivo/Inválido" (una fila de esta tabla = un eje, con 2 discos
// independientes) — prefijado por lado solo cuando hace falta desambiguar.
function textoMotivosFila(fila: FilaEspejoVisible): string {
  const partes: string[] = []
  if (fila.izquierdo.motivosVisibles.length > 0) {
    partes.push(
      `Izq: ${fila.izquierdo.motivosVisibles.map((m) => m.motivo).join('; ')}`,
    )
  }
  if (fila.derecho.motivosVisibles.length > 0) {
    partes.push(
      `Der: ${fila.derecho.motivosVisibles.map((m) => m.motivo).join('; ')}`,
    )
  }
  return partes.join(' — ')
}

function calcularRowSpanCoche(filas: FilaEspejoVisible[]): FilaRender[] {
  return filas.map((fila, indice) => {
    const clave = claveCocheDe(fila)
    const anterior = filas[indice - 1]
    if (anterior && claveCocheDe(anterior) === clave) {
      return { ...fila, mostrarCoche: false, cocheRowSpan: 0 }
    }

    let rowSpan = 1
    for (let i = indice + 1; i < filas.length; i += 1) {
      if (claveCocheDe(filas[i]) !== clave) break
      rowSpan += 1
    }
    return { ...fila, mostrarCoche: true, cocheRowSpan: rowSpan }
  })
}

function Encabezado({
  children,
  mono = false,
}: {
  children: React.ReactNode
  mono?: boolean
}) {
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
  rowSpan,
}: {
  children: React.ReactNode
  mono?: boolean
  className?: string
  rowSpan?: number
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={`overflow-hidden px-1 py-1 text-concreto-oscuro ${mono ? 'text-right font-data' : ''} ${className}`.trim()}
    >
      {children}
    </td>
  )
}


// Punto 3 del enunciado: ámbar — el valor es válido de formato, solo quedó
// marcado por la validación cruzada contra el historial. Ring en vez de
// border: no desplaza el layout de la celda al aparecer/desaparecer.
const CLASE_RESALTADO =
  'ring-1 ring-inset ring-[color:var(--color-estado-seguimiento)] bg-[color:var(--color-estado-seguimiento)]/10 rounded-lg'

// Pista visual de "esto se llena a mano": con la tabla desbloqueada, T y H
// son los únicos 2 campos realmente editables de toda la fila (Rd/Estado
// siempre los calcula el backend) — sin este resaltado quedaban visualmente
// idénticos a una celda de solo lectura. Cede ante CLASE_RESALTADO (ámbar,
// prioridad de validación) cuando ambos aplicarían a la vez.
const CLASE_EDITABLE =
  'ring-1 ring-inset ring-[color:var(--color-verde-institucional)]/30 bg-[color:var(--color-verde-institucional)]/[0.06] rounded-lg'

function serieBogie(codigo: string): string {
  return codigo.includes('/')
    ? codigo.split('/').at(-1)?.trim() || codigo
    : codigo
}

function partesBogieCodigo(
  fila: FilaEspejo,
  codigosBogie: CodigosBogie | null,
): { bogie: string; serie: string | null } {
  const codigo = codigosBogie?.[`${fila.tipoCoche}:${fila.bogieCodigo}`]
  return {
    bogie: fila.bogieCodigo,
    serie: codigo ? serieBogie(codigo) : null,
  }
}

function FilaEspejoRow({
  fichaId,
  fila,
  deshabilitada,
  resaltarInvalidos,
  mostrarColumnaMotivo,
  codigosBogie,
  onComparar,
}: {
  fichaId: string
  fila: FilaRender
  deshabilitada: boolean
  resaltarInvalidos: boolean
  mostrarColumnaMotivo: boolean
  codigosBogie: CodigosBogie | null
  onComparar?: (tipoCoche: string, numeroCoche: number | null) => void
}) {
  const izq = useLadoEditable(
    fichaId,
    fila.ejeNumero,
    'izquierdo',
    fila.izquierdo,
  )
  const der = useLadoEditable(fichaId, fila.ejeNumero, 'derecho', fila.derecho)
  const resaltarTIzq =
    resaltarInvalidos && tieneMotivo(fila.izquierdo.motivos, 't')
  const resaltarRdIzq =
    resaltarInvalidos && tieneMotivo(fila.izquierdo.motivos, 'rd')
  const resaltarTDer =
    resaltarInvalidos && tieneMotivo(fila.derecho.motivos, 't')
  const resaltarRdDer =
    resaltarInvalidos && tieneMotivo(fila.derecho.motivos, 'rd')
  const bogieCodigo = partesBogieCodigo(fila, codigosBogie)

  return (
    <tr className="tabla-fila--glass border-b border-concreto/10">
      {mostrarColumnaMotivo && (
        <td className="w-[12rem] break-words px-2 py-1.5 align-top">
          {hayMotivoVisible(fila.izquierdo) ||
          hayMotivoVisible(fila.derecho) ? (
            <WarningTooltip texto={textoMotivosFila(fila)} className="block">
              <span className="block cursor-help space-y-1 whitespace-normal text-pretty font-body text-xs leading-snug">
                <MotivosLado lado="Izq" datos={fila.izquierdo} />
                <MotivosLado lado="Der" datos={fila.derecho} />
              </span>
            </WarningTooltip>
          ) : (
            <span className="font-body text-xs text-concreto">—</span>
          )}
        </td>
      )}

      <Celda>
        <span className="block whitespace-nowrap font-semibold">
          {bogieCodigo.bogie}
          {bogieCodigo.serie !== null && (
            <span className="text-concreto"> · {bogieCodigo.serie}</span>
          )}
        </span>
      </Celda>
      <CeldaEstado estado={fila.izquierdo.estadoCalculado} />
      <Celda mono className={resaltarRdIzq ? CLASE_RESALTADO : ''}>
        {fila.izquierdo.rdValue !== null
          ? fila.izquierdo.rdValue.toFixed(2)
          : '—'}
      </Celda>
      <CampoNumero
        valor={izq.tValue}
        onGuardar={izq.guardarT}
        deshabilitada={deshabilitada}
        resaltado={resaltarTIzq}
      />
      <CampoNumero
        valor={izq.hValue}
        onGuardar={izq.guardarH}
        deshabilitada={deshabilitada}
        pendiente={izq.pendiente}
      />
      <Celda mono className="w-9">
        {fila.ejeNumero}
      </Celda>
      <Celda mono className="w-9">
        {fila.izquierdo.ruedaNumero}
      </Celda>

      {fila.mostrarCoche && (
        <Celda
          rowSpan={fila.cocheRowSpan}
          className="bg-white/40 text-center align-middle font-semibold"
        >
          <span className="block">
            {fila.tipoCoche}
            {fila.numeroCoche !== null && (
              <span className="text-concreto"> · {fila.numeroCoche}</span>
            )}
          </span>
          {onComparar && (
            <button
              type="button"
              onClick={() => onComparar(fila.tipoCoche, fila.numeroCoche)}
              className="mt-1 rounded-full border border-verde-institucional/30 bg-verde-institucional/[0.06] px-2 py-0.5 font-body text-[0.625rem] font-semibold uppercase tracking-wide text-verde-oscuro transition-colors hover:bg-verde-institucional/[0.12]"
            >
              Comparar
            </button>
          )}
        </Celda>
      )}

      <Celda mono className="w-9">
        {fila.derecho.ruedaNumero}
      </Celda>
      <Celda mono className="w-9">
        {fila.ejeNumero}
      </Celda>
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
        <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>
          {estado}
        </span>
      ) : (
        // +2pt (mismo criterio que .tabla-chip) para que el "sin dato" combine con el chip de estado
        <span className="font-body text-[0.9167rem] text-concreto">—</span>
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
  const [borrador, setBorrador] = useSyncedState(
    valor === null ? '' : String(valor),
  )
  let claseCelda = 'rounded-lg border-transparent bg-transparent'
  if (resaltado) claseCelda = CLASE_RESALTADO
  else if (!deshabilitada) claseCelda = CLASE_EDITABLE

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
            if (borrador.trim() !== '' && Number.isFinite(n) && n !== valor)
              onGuardar(n)
          }}
          placeholder="—"
          // +2pt sobre los 12px (9pt) originales — mismo ajuste que el resto de la tabla de datos
          className={`w-full min-w-0 border px-1 py-1 text-right font-data text-[0.9167rem] text-concreto-oscuro transition-colors hover:border-concreto/25 focus:border-verde-institucional focus:bg-white/70 focus:outline-none disabled:opacity-50 ${claseCelda}`.trim()}
        />
        {pendiente && (
          <WarningTooltip texto="Completa Espesor (T) y Desgaste (H) para guardar esta fila.">
            ⚠️
          </WarningTooltip>
        )}
      </span>
    </td>
  )
}
