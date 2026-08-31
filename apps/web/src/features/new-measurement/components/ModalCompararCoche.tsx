import { useMemo } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { aFechaCorta } from '../fecha'
import {
  claveCocheDe,
  construirFilasEspejo,
  type LadoFilaEspejo,
} from '../filaEspejo'
import { useReferenciaFicha } from '../queries'
import type { EstadoDisco, PosicionEsqueleto, PreviewRow } from '../types'
import { useLadoEditable } from '../useLadoEditable'

type Lado = 'izquierdo' | 'derecho'

type FilaPlana = {
  ejeNumero: number
  lado: Lado
  ruedaNumero: number
  datos: LadoFilaEspejo
}

type Props = {
  fichaId: string
  trenNumero: number
  tipoCoche: string
  numeroCoche: number | null
  esqueletoActual: PosicionEsqueleto[]
  rowsActual: PreviewRow[]
  deshabilitada: boolean
  onCerrar: () => void
}

// Aplana las 3 filas-eje de UN coche (construirFilasEspejo ya arma eje+izq/
// der) a 6 filas planas por rueda (Rueda | Estado | Rd | T | H), en el orden
// eje ASC, izquierdo antes que derecho — mismo orden físico que la tabla
// principal.
function filasPlanasDeCoche(
  esqueleto: PosicionEsqueleto[],
  rows: PreviewRow[],
  tipoCoche: string,
  numeroCoche: number | null,
): FilaPlana[] {
  const clave = `${tipoCoche}|${numeroCoche ?? ''}`
  const filasDelCoche = construirFilasEspejo(esqueleto, rows).filter(
    (fila) => claveCocheDe(fila) === clave,
  )
  return filasDelCoche.flatMap((fila) => [
    { ejeNumero: fila.ejeNumero, lado: 'izquierdo' as const, ruedaNumero: fila.izquierdo.ruedaNumero, datos: fila.izquierdo },
    { ejeNumero: fila.ejeNumero, lado: 'derecho' as const, ruedaNumero: fila.derecho.ruedaNumero, datos: fila.derecho },
  ])
}

// Modal "Comparar" por coche (punto pedido: medición ACTUAL editable —solo
// T/H— junto a la última medición CONFIRMADA de cada rueda, de solo
// lectura). A diferencia de ModalMedicionAnterior.tsx (que muestra una ficha
// histórica completa vía TablaFichaEspejo, las 48 posiciones), acá se
// acotan ambos lados a las ~6 ruedas de UN coche y se renderizan como listas
// planas simples (Rueda|Estado|Rd|T|H|Fecha), tal como lo pidió el usuario —
// no vale la pena generalizar TablaFichaEspejo para este caso mucho más chico.
export function ModalCompararCoche({
  fichaId,
  trenNumero,
  tipoCoche,
  numeroCoche,
  esqueletoActual,
  rowsActual,
  deshabilitada,
  onCerrar,
}: Props) {
  const referencia = useReferenciaFicha(trenNumero, 'ultima_medicion')

  const filasActual = useMemo(
    () => filasPlanasDeCoche(esqueletoActual, rowsActual, tipoCoche, numeroCoche),
    [esqueletoActual, rowsActual, tipoCoche, numeroCoche],
  )

  const filasAnterior = useMemo(() => {
    if (!referencia.data || referencia.data.disponible === false) return []
    return filasPlanasDeCoche(referencia.data.esqueleto, referencia.data.rows, tipoCoche, numeroCoche)
  }, [referencia.data, tipoCoche, numeroCoche])

  const titulo = `Comparar — ${tipoCoche}${numeroCoche !== null ? ` · ${numeroCoche}` : ''}`

  return (
    <GlassModal
      titulo={titulo}
      onCerrar={onCerrar}
      ancho={1200}
      altoMaximo="min(88dvh, 44rem)"
      footer={
        <div className="mt-5 flex justify-end">
          <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
            Cerrar
          </GlassButton>
        </div>
      }
    >
      <ScrollArea ejes="both" className="mt-1 flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1 pr-3 pb-3">
        <div className="grid min-w-[68rem] grid-cols-2 gap-4">
          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-concreto-oscuro">Medición actual</h3>
            <TablaPlana>
              {filasActual.map((f) => (
                <FilaActual key={`${f.ejeNumero}-${f.lado}`} fichaId={fichaId} fila={f} deshabilitada={deshabilitada} />
              ))}
            </TablaPlana>
          </div>

          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-concreto-oscuro">Última medición</h3>
            {referencia.isLoading ? (
              <p className="font-body text-sm text-concreto">Cargando…</p>
            ) : referencia.isError ? (
              <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
                No se pudo cargar la comparativa.
              </p>
            ) : !referencia.data || referencia.data.disponible === false ? (
              <p className="font-body text-sm text-concreto">Este tren todavía no tiene mediciones confirmadas.</p>
            ) : (
              <TablaPlana soloLectura>
                {filasAnterior.map((f) => (
                  <FilaAnterior key={`${f.ejeNumero}-${f.lado}`} fila={f} />
                ))}
              </TablaPlana>
            )}
          </div>
        </div>
      </ScrollArea>
    </GlassModal>
  )
}

function TablaPlana({ children, soloLectura = false }: { children: React.ReactNode; soloLectura?: boolean }) {
  return (
    <GlassSurface fuerte className="overflow-hidden rounded-sm">
      <table className="w-full table-fixed border-collapse text-left font-body text-sm">
        <thead>
          <tr className="border-b border-concreto/20">
            <Encabezado>Rueda</Encabezado>
            {soloLectura ? (
              <>
                <Encabezado mono>T</Encabezado>
                <Encabezado mono>H</Encabezado>
                <Encabezado mono>Rd</Encabezado>
                <Encabezado>Estado</Encabezado>
              </>
            ) : (
              <>
                <Encabezado>Estado</Encabezado>
                <Encabezado mono>Rd</Encabezado>
                <Encabezado mono>T</Encabezado>
                <Encabezado mono>H</Encabezado>
              </>
            )}
            <Encabezado>Fecha</Encabezado>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </GlassSurface>
  )
}

function Encabezado({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <th
      className={`bg-[color:var(--color-arena-suave)] px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto ${mono ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function CeldaEstado({ estado }: { estado: EstadoDisco | null }) {
  return (
    <td className="whitespace-nowrap px-2 py-1.5">
      {estado ? <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>{estado}</span> : <span className="text-concreto">—</span>}
    </td>
  )
}

const CLASE_CHIP_ESTADO: Record<EstadoDisco, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

function FilaActual({
  fichaId,
  fila,
  deshabilitada,
}: {
  fichaId: string
  fila: FilaPlana
  deshabilitada: boolean
}) {
  const editable = useLadoEditable(fichaId, fila.ejeNumero, fila.lado, fila.datos)

  return (
    <tr className="border-b border-concreto/10">
      <td className="px-2 py-1.5 font-data text-concreto-oscuro">{fila.ruedaNumero}</td>
      <CeldaEstado estado={fila.datos.estadoCalculado} />
      <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
        {fila.datos.rdValue !== null ? fila.datos.rdValue.toFixed(2) : '—'}
      </td>
      <CampoNumero valor={editable.tValue} onGuardar={editable.guardarT} deshabilitada={deshabilitada} />
      <CampoNumero valor={editable.hValue} onGuardar={editable.guardarH} deshabilitada={deshabilitada} />
      <td className="px-2 py-1.5 font-data text-xs text-concreto">{aFechaCorta(fila.datos.fecha) || '—'}</td>
    </tr>
  )
}

function FilaAnterior({ fila }: { fila: FilaPlana }) {
  return (
    <tr className="border-b border-concreto/10">
      <td className="px-2 py-1.5 font-data text-concreto-oscuro">{fila.ruedaNumero}</td>
      <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
        {fila.datos.tValue !== null ? fila.datos.tValue.toFixed(2) : '—'}
      </td>
      <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
        {fila.datos.hValue !== null ? fila.datos.hValue.toFixed(2) : '—'}
      </td>
      <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
        {fila.datos.rdValue !== null ? fila.datos.rdValue.toFixed(2) : '—'}
      </td>
      <CeldaEstado estado={fila.datos.estadoCalculado} />
      <td className="px-2 py-1.5 font-data text-xs text-concreto">{aFechaCorta(fila.datos.fecha) || '—'}</td>
    </tr>
  )
}

function CampoNumero({
  valor,
  onGuardar,
  deshabilitada,
}: {
  valor: number | null
  onGuardar: (n: number) => void
  deshabilitada: boolean
}) {
  const [borrador, setBorrador] = useSyncedState(valor === null ? '' : String(valor))
  return (
    <td className="px-1 py-1 text-right">
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
        className={`w-full min-w-0 rounded-sm border px-1 py-1 text-right font-data text-sm text-concreto-oscuro transition-colors hover:border-concreto/25 focus:border-verde-institucional focus:bg-white/70 focus:outline-none disabled:opacity-50 ${
          deshabilitada ? 'border-transparent bg-transparent' : 'border-transparent bg-verde-institucional/[0.06] ring-1 ring-inset ring-verde-institucional/30'
        }`}
      />
    </td>
  )
}
