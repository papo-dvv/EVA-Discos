import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { construirFilasEspejo, type LadoFilaEspejo } from '../filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import type { ValorPrevioDisco } from '../referenciaAnterior'
import type { PosicionEsqueleto, PreviewRow } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  referenciaPorEjeLado?: Map<string, ValorPrevioDisco>
  deshabilitada?: boolean
}

// Ficha UT-UF-MTO-FR-414 adaptada al lenguaje visual del proyecto: conserva
// la lectura espejo del tren y separa explícitamente valores antes/después.
export function TablaFichaReperfilado({
  fichaId,
  esqueleto,
  rows,
  referenciaPorEjeLado,
  deshabilitada = false,
}: Props) {
  const filas = useMemo(() => construirFilasEspejo(esqueleto, rows), [esqueleto, rows])

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div className="border-b border-concreto/15 bg-white/35 px-5 py-3">
        <h2 className="font-display text-base font-semibold text-concreto-oscuro">Control disco de freno</h2>
        <p className="mt-0.5 font-body text-xs text-concreto">
          Antes del reperfilado: última medición confirmada · Después: valores obtenidos en torno fosa
        </p>
      </div>
      <ScrollArea ejes="both" viewportClassName="max-h-[36rem]">
        <table className="min-w-[88rem] w-full border-collapse font-body text-xs">
          <thead>
            <tr className="border-b border-concreto/20 bg-[color:var(--color-arena-suave)]">
              <th rowSpan={3} className="px-2 py-2 text-left">Bogie / código</th>
              <th colSpan={5} className="px-2 py-2 text-center">Disco lado izquierdo</th>
              <th rowSpan={3} className="px-3 py-2 text-center">Eje</th>
              <th rowSpan={3} className="px-3 py-2 text-center">Coche</th>
              <th colSpan={5} className="px-2 py-2 text-center">Disco lado derecho</th>
            </tr>
            <tr className="border-b border-concreto/15 bg-white/55 text-concreto">
              <th colSpan={2} className="px-2 py-1.5 text-center">Antes del reperfilado</th>
              <th colSpan={3} className="px-2 py-1.5 text-center">Después del reperfilado</th>
              <th colSpan={2} className="px-2 py-1.5 text-center">Antes del reperfilado</th>
              <th colSpan={3} className="px-2 py-1.5 text-center">Después del reperfilado</th>
            </tr>
            <tr className="border-b border-concreto/20 bg-white/45 text-[0.6875rem] uppercase tracking-wide text-concreto">
              <th className="px-2 py-2">Espesor (mm)</th><th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="px-2 py-2">Espesor (mm)</th><th className="px-2 py-2">Cóncavo (mm)</th><th className="px-2 py-2">Ra (µm)</th>
              <th className="px-2 py-2">Espesor (mm)</th><th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="px-2 py-2">Espesor (mm)</th><th className="px-2 py-2">Cóncavo (mm)</th><th className="px-2 py-2">Ra (µm)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.ejeNumero} className="tabla-fila--glass border-b border-concreto/10">
                <td className="px-2.5 py-1.5 font-semibold text-concreto-oscuro">{fila.bogieCodigo}</td>
                <LadoReperfilado fichaId={fichaId} eje={fila.ejeNumero} lado="izquierdo" datos={fila.izquierdo} previo={referenciaPorEjeLado?.get(`${fila.ejeNumero}|izquierdo`)} deshabilitada={deshabilitada} />
                <td className="px-3 py-1.5 text-center font-data text-concreto-oscuro">{fila.ejeNumero}</td>
                <td className="bg-white/40 px-3 py-1.5 text-center font-semibold text-concreto-oscuro">
                  {fila.tipoCoche}{fila.numeroCoche !== null ? ` · ${fila.numeroCoche}` : ''}
                </td>
                <LadoReperfilado fichaId={fichaId} eje={fila.ejeNumero} lado="derecho" datos={fila.derecho} previo={referenciaPorEjeLado?.get(`${fila.ejeNumero}|derecho`)} deshabilitada={deshabilitada} />
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="grid grid-cols-1 gap-2 border-t border-concreto/15 bg-white/35 px-5 py-3 font-body text-xs text-concreto sm:grid-cols-3">
        <span>Espesor posterior &gt; 0,3 mm</span>
        <span>Desgaste cóncavo ≤ 2,0 mm</span>
        <span>RA automático = Espesor − Cóncavo (0 a 3,2 mm)</span>
      </div>
    </GlassSurface>
  )
}

function LadoReperfilado({ fichaId, eje, lado, datos, previo, deshabilitada }: {
  fichaId: string
  eje: number
  lado: Lado
  datos: LadoFilaEspejo
  previo?: ValorPrevioDisco
  deshabilitada: boolean
}) {
  const agregar = useAgregarFilaFicha(fichaId)
  const editar = useEditarFilaFicha(fichaId)
  // El archivo cargado en Reperfilado contiene los valores obtenidos por el
  // equipo tras el trabajo: T/H deben aparecer directamente en "Después".
  // "Antes" viene de la última medición confirmada; los campos *_Antes solo
  // quedan como respaldo para fichas antiguas creadas por el flujo legado.
  const [t, setT] = useSyncedState(datos.tValue)
  const [h, setH] = useSyncedState(datos.hValue)
  const previoReal = previo

  function guardar(campo: 'tValue' | 'hValue', valor: number) {
    if (campo === 'tValue') setT(valor)
    if (campo === 'hValue') setH(valor)
    const tFinal = campo === 'tValue' ? valor : t
    const hFinal = campo === 'hValue' ? valor : h
    if (datos.recordId) {
      editar.mutate({ recordId: datos.recordId, cambios: { [campo]: valor } })
      return
    }
    if (tFinal !== null && hFinal !== null) {
      agregar.mutate({ ejeNumero: eje, lado, tValue: tFinal, hValue: hFinal })
    }
  }

  return (
    <>
      <ValorPrevio valor={previoReal?.tValue} />
      <ValorPrevio valor={previoReal?.hValue} />
      <Campo valor={t} onGuardar={(v) => guardar('tValue', v)} disabled={deshabilitada} />
      <Campo valor={h} onGuardar={(v) => guardar('hValue', v)} disabled={deshabilitada} invalido={h !== null && h > 2} />
      <ValorCalculado valor={t !== null && h !== null ? t - h : null} />
    </>
  )
}

function ValorCalculado({ valor }: { valor: number | null }) {
  const invalido = valor !== null && (valor < 0 || valor > 3.2)
  return (
    <td className="px-1.5 py-1">
      <output className={`glass-field block w-20 px-2 py-1 text-right font-data text-xs ${invalido ? 'border-[color:var(--color-estado-critico)]' : ''}`}>
        {valor === null ? '—' : valor.toFixed(2)}
      </output>
    </td>
  )
}

function ValorPrevio({ valor }: { valor?: number }) {
  return <td className="bg-white/25 px-2 py-1.5 text-right font-data text-concreto">{valor === undefined ? '—' : valor.toFixed(2)}</td>
}

function Campo({ valor, onGuardar, disabled, invalido = false }: {
  valor: number | null
  onGuardar: (valor: number) => void
  disabled: boolean
  invalido?: boolean
}) {
  const [borrador, setBorrador] = useSyncedState(valor === null ? '' : String(valor))
  return (
    <td className="px-1.5 py-1">
      <input
        type="number"
        step="0.01"
        disabled={disabled}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => {
          const n = Number(borrador)
          if (borrador !== '' && Number.isFinite(n) && n !== valor) onGuardar(n)
        }}
        className={`glass-field w-20 px-2 py-1 text-right font-data text-xs ${invalido ? 'border-[color:var(--color-estado-critico)]' : ''}`}
      />
    </td>
  )
}
