import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { ScrollArea } from '../../../components/ScrollArea'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { construirFilasEspejo, type LadoFilaEspejo } from '../filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import type { PosicionEsqueleto, PreviewRow } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  deshabilitada?: boolean
}

// Ficha UT-UF-MTO-FR-414 adaptada al lenguaje visual del proyecto: conserva
// la lectura espejo del tren y separa explícitamente valores antes/después.
export function TablaFichaReperfilado({
  fichaId,
  esqueleto,
  rows,
  deshabilitada = false,
}: Props) {
  const filas = useMemo(
    () => construirFilasEspejo(esqueleto, rows),
    [esqueleto, rows],
  )

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div className="border-b border-concreto/15 bg-white/35 px-5 py-3">
        <h2 className="font-display text-base font-semibold text-concreto-oscuro">
          Control disco de freno
        </h2>
        <p className="mt-0.5 font-body text-xs text-concreto">
          Completa los cinco cuadros en blanco de cada lado con los valores de
          la ficha física.
        </p>
      </div>
      <ScrollArea ejes="both" viewportClassName="max-h-[36rem]">
        <table className="min-w-[88rem] w-full border-collapse font-body text-xs">
          <thead>
            <tr className="border-b border-concreto/20 bg-[color:var(--color-arena-suave)]">
              <th rowSpan={3} className="px-2 py-2 text-left">
                Bogie / código
              </th>
              <th colSpan={5} className="px-2 py-2 text-center">
                Disco lado izquierdo
              </th>
              <th rowSpan={3} className="px-3 py-2 text-center">
                Eje
              </th>
              <th rowSpan={3} className="px-3 py-2 text-center">
                Coche
              </th>
              <th colSpan={5} className="px-2 py-2 text-center">
                Disco lado derecho
              </th>
            </tr>
            <tr className="border-b border-concreto/15 bg-white/55 text-concreto">
              <th colSpan={2} className="px-2 py-1.5 text-center">
                Antes del reperfilado
              </th>
              <th colSpan={3} className="px-2 py-1.5 text-center">
                Después del reperfilado
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center">
                Antes del reperfilado
              </th>
              <th colSpan={3} className="px-2 py-1.5 text-center">
                Después del reperfilado
              </th>
            </tr>
            <tr className="border-b border-concreto/20 bg-white/45 text-[0.6875rem] uppercase tracking-wide text-concreto">
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="border-l-2 border-concreto/25 px-2 py-2">
                R.A. (µm)
              </th>
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="border-l-2 border-concreto/25 px-2 py-2">
                R.A. (µm)
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={fila.ejeNumero}
                className={`tabla-fila--glass border-b border-concreto/10 ${
                  (fila.ejeNumero - 1) % 4 === 0
                    ? 'border-t-4 border-t-concreto/30'
                    : ''
                }`}
              >
                <td className="px-2.5 py-1.5 font-semibold text-concreto-oscuro">
                  {fila.bogieCodigo}
                </td>
                <LadoReperfilado
                  fichaId={fichaId}
                  eje={fila.ejeNumero}
                  lado="izquierdo"
                  datos={fila.izquierdo}
                  deshabilitada={deshabilitada}
                />
                <td className="px-3 py-1.5 text-center font-data text-concreto-oscuro">
                  {fila.ejeNumero}
                </td>
                <td className="bg-white/40 px-3 py-1.5 text-center font-semibold text-concreto-oscuro">
                  {fila.tipoCoche}
                  {fila.numeroCoche !== null ? ` · ${fila.numeroCoche}` : ''}
                </td>
                <LadoReperfilado
                  fichaId={fichaId}
                  eje={fila.ejeNumero}
                  lado="derecho"
                  datos={fila.derecho}
                  deshabilitada={deshabilitada}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="grid grid-cols-1 gap-2 border-t border-concreto/15 bg-white/35 px-5 py-3 font-body text-xs text-concreto sm:grid-cols-3">
        <span>Espesor posterior &gt; 0,3 mm</span>
        <span>Desgaste cóncavo ≤ 2,0 mm</span>
        <span>R.A. se registra desde la ficha, sin valores predeterminados</span>
      </div>
    </GlassSurface>
  )
}

function LadoReperfilado({
  fichaId,
  eje,
  lado,
  datos,
  deshabilitada,
}: {
  fichaId: string
  eje: number
  lado: Lado
  datos: LadoFilaEspejo
  deshabilitada: boolean
}) {
  const agregar = useAgregarFilaFicha(fichaId)
  const editar = useEditarFilaFicha(fichaId)
  const [t, setT] = useSyncedState(datos.tValue)
  const [h, setH] = useSyncedState(datos.hValue)
  const [tAntes, setTAntes] = useSyncedState(datos.reperfiladoTAntes)
  const [hAntes, setHAntes] = useSyncedState(datos.reperfiladoHAntes)
  const [ra, setRa] = useSyncedState(datos.rugosidadRa)

  function guardar(
    campo:
      | 'tValue'
      | 'hValue'
      | 'reperfiladoTAntes'
      | 'reperfiladoHAntes'
      | 'rugosidadRa',
    valor: number,
  ) {
    if (campo === 'tValue') setT(valor)
    if (campo === 'hValue') setH(valor)
    if (campo === 'reperfiladoTAntes') setTAntes(valor)
    if (campo === 'reperfiladoHAntes') setHAntes(valor)
    if (campo === 'rugosidadRa') setRa(valor)
    const tFinal = campo === 'tValue' ? valor : t
    const hFinal = campo === 'hValue' ? valor : h
    if (datos.recordId) {
      editar.mutate({ recordId: datos.recordId, cambios: { [campo]: valor } })
      return
    }
    if (tFinal !== null && hFinal !== null) {
      agregar.mutate({
        ejeNumero: eje,
        lado,
        tValue: tFinal,
        hValue: hFinal,
        reperfiladoTAntes:
          campo === 'reperfiladoTAntes' ? valor : (tAntes ?? undefined),
        reperfiladoHAntes:
          campo === 'reperfiladoHAntes' ? valor : (hAntes ?? undefined),
        rugosidadRa: campo === 'rugosidadRa' ? valor : (ra ?? undefined),
      })
    }
  }

  return (
    <>
      <Campo
        valor={tAntes}
        onGuardar={(v) => guardar('reperfiladoTAntes', v)}
        disabled={deshabilitada}
      />
      <Campo
        valor={hAntes}
        onGuardar={(v) => guardar('reperfiladoHAntes', v)}
        disabled={deshabilitada}
      />
      <Campo
        valor={t}
        onGuardar={(v) => guardar('tValue', v)}
        disabled={deshabilitada}
      />
      <Campo
        valor={h}
        onGuardar={(v) => guardar('hValue', v)}
        disabled={deshabilitada}
        invalido={h !== null && h > 2}
      />
      <Campo
        valor={ra}
        onGuardar={(v) => guardar('rugosidadRa', v)}
        disabled={deshabilitada}
      />
    </>
  )
}

function Campo({
  valor,
  onGuardar,
  disabled,
  invalido = false,
}: {
  valor: number | null
  onGuardar: (valor: number) => void
  disabled: boolean
  invalido?: boolean
}) {
  const [borrador, setBorrador] = useSyncedState(
    valor === null ? '' : String(valor),
  )
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
