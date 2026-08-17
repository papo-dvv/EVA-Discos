import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { construirFilasEspejo, type LadoFilaEspejo } from '../filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import type { CambiosFicha, CodigosBogie, CodigosCoche, PosicionEsqueleto, PreviewRow, TipoCoche } from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  codigosCoche: CodigosCoche | null
  codigosBogie: CodigosBogie | null
  onGuardarCodigos: (cambios: CambiosFicha) => void
  deshabilitada?: boolean
}

const TIPOS_COCHE: TipoCoche[] = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2']
const RUGOSIDAD_RA_OBJETIVO = 2.5
const opcionesCoche = (tipo: TipoCoche) => {
  const offset = { MA1: 101, MB1: 102, MB2: 103, MA2: 104 }[tipo as 'MA1' | 'MB1' | 'MB2' | 'MA2']
  if (offset) return Array.from({ length: 39 }, (_, indice) => String(offset + indice * 4))
  const inicio = tipo === 'MB3' ? 501 : 401
  return Array.from({ length: 39 }, (_, indice) => String(inicio + indice))
}

// Ficha UT-UF-MTO-FR-414 adaptada al lenguaje visual del proyecto: conserva
// la lectura espejo del tren y separa explícitamente valores antes/después.
export function TablaFichaReperfilado({
  fichaId,
  esqueleto,
  rows,
  codigosCoche,
  codigosBogie,
  onGuardarCodigos,
  deshabilitada = false,
}: Props) {
  const filas = useMemo(
    () => construirFilasEspejo(esqueleto, rows),
    [esqueleto, rows],
  )
  const [soloPendientes, setSoloPendientes] = useState(false)
  const ladoCompleto = (lado: LadoFilaEspejo) =>
    lado.reperfiladoTAntes !== null &&
    lado.reperfiladoHAntes !== null &&
    lado.tValue !== null &&
    lado.hValue !== null &&
    (lado.rugosidadRa !== null || lado.recordId !== null)
  const ladosCompletos = filas.reduce(
    (total, fila) =>
      total +
      Number(ladoCompleto(fila.izquierdo)) +
      Number(ladoCompleto(fila.derecho)),
    0,
  )
  const totalLados = filas.length * 2
  const porcentaje = totalLados
    ? Math.round((ladosCompletos / totalLados) * 100)
    : 0
  const fueraDeLimite = filas.reduce((total, fila) => {
    const lados = [fila.izquierdo, fila.derecho]
    return total + lados.filter((lado) =>
      (lado.reperfiladoTAntes !== null && lado.reperfiladoTAntes <= 0) ||
      (lado.reperfiladoHAntes !== null && lado.reperfiladoHAntes > 2) ||
      (lado.tValue !== null && lado.tValue <= 0.3) ||
      (lado.hValue !== null && lado.hValue > 2) ||
      (lado.rugosidadRa !== null && lado.rugosidadRa !== RUGOSIDAD_RA_OBJETIVO),
    ).length
  }, 0)
  const filasVisibles = soloPendientes
    ? filas.filter(
        (fila) =>
          !ladoCompleto(fila.izquierdo) || !ladoCompleto(fila.derecho),
      )
    : filas
  const cochesActuales = Object.fromEntries(TIPOS_COCHE.map((tipo) => [
    tipo,
    codigosCoche?.[tipo] ?? null,
  ])) as CodigosCoche

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div className="border-b border-concreto/15 bg-white/35 px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-concreto-oscuro">
              Control disco de freno
            </h2>
            <p className="mt-0.5 font-body text-xs text-concreto">
              Completa las cinco mediciones de cada lado tal como aparecen en
              la ficha física, incluida la rugosidad R.A. Los códigos de bogie y coche se editan dentro de esta misma tabla.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={soloPendientes}
            onClick={() => setSoloPendientes((actual) => !actual)}
            className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold transition ${
              soloPendientes
                ? 'border-emerald-700/25 bg-emerald-700/10 text-emerald-800'
                : 'border-concreto/15 bg-white/45 text-concreto'
            }`}
          >
            {soloPendientes ? 'Mostrando pendientes' : 'Ver solo pendientes'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ResumenDato etiqueta="Completados" valor={`${ladosCompletos}/${totalLados}`} />
          <ResumenDato etiqueta="Pendientes" valor={String(totalLados - ladosCompletos)} />
          <div className="col-span-2 rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2 sm:col-span-1">
            <div className="flex items-center justify-between font-body text-[0.6875rem] text-concreto">
              <span>Avance</span>
              <strong className="font-data text-concreto-oscuro">{porcentaje}%</strong>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-concreto/10">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        </div>
        {(totalLados - ladosCompletos > 0 || fueraDeLimite > 0) && (
          <div role="alert" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-2xl border border-amber-600/20 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
            {totalLados - ladosCompletos > 0 && <span>⚠ Faltan {totalLados - ladosCompletos} posiciones por completar.</span>}
            {fueraDeLimite > 0 && <span>⚠ {fueraDeLimite} posiciones tienen al menos un valor fuera del límite.</span>}
          </div>
        )}
      </div>
      <div className="w-full">
        <table className="w-full table-fixed border-collapse font-body text-xs">
          <colgroup>
            <col className="w-[7%]" />
            {Array.from({ length: 5 }, (_, indice) => (
              <col key={`izq-${indice}`} className="w-[7.25%]" />
            ))}
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            {Array.from({ length: 5 }, (_, indice) => (
              <col key={`der-${indice}`} className="w-[7.25%]" />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 shadow-sm">
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
            {filasVisibles.map((fila) => (
              <tr
                key={fila.ejeNumero}
                className={`tabla-fila--glass border-b border-concreto/10 ${
                  (fila.ejeNumero - 1) % 4 === 0
                    ? 'border-t-4 border-t-concreto/30'
                    : ''
                }`}
              >
                {(soloPendientes || (fila.ejeNumero - 1) % 2 === 0) && (
                  <td rowSpan={soloPendientes ? 1 : 2} className="px-2 py-1.5 align-middle font-semibold text-concreto-oscuro">
                    <div className="flex items-center justify-between gap-1">
                      <span>{fila.bogieCodigo}</span>
                      {(fila.ejeNumero - 1) % 4 === 0 && <span className="rounded-full bg-concreto/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wide text-concreto">B{Math.ceil(fila.ejeNumero / 4)}</span>}
                    </div>
                    <CampoCodigoTabla
                      etiqueta={`Código ${fila.tipoCoche} ${fila.bogieCodigo}`}
                      valor={codigosBogie?.[`${fila.tipoCoche}:${fila.bogieCodigo}`] ?? ''}
                      opciones={['PB2', 'PB3', 'PB4', 'PB6', 'TB1', 'TB2']}
                      disabled={deshabilitada}
                      onGuardar={(codigo) => onGuardarCodigos({ codigosBogie: { ...(codigosBogie ?? {}), [`${fila.tipoCoche}:${fila.bogieCodigo}`]: codigo } })}
                    />
                  </td>
                )}
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
                {(soloPendientes || (fila.ejeNumero - 1) % 4 === 0) && (
                  <td
                    rowSpan={soloPendientes ? 1 : 4}
                    className="border-x-2 border-concreto/20 bg-white/55 px-3 py-1.5 text-center align-middle font-semibold text-concreto-oscuro"
                  >
                    <span className="block text-sm">{fila.tipoCoche}</span>
                    <CampoCodigoTabla
                      etiqueta={`Código coche ${fila.tipoCoche}`}
                      valor={String(cochesActuales[fila.tipoCoche as TipoCoche] ?? '')}
                      opciones={opcionesCoche(fila.tipoCoche as TipoCoche)}
                      disabled={deshabilitada}
                      onGuardar={(codigo) => {
                        const numero = Number(codigo)
                        if (Number.isInteger(numero) && numero > 0) onGuardarCodigos({ codigosCoche: { ...cochesActuales, [fila.tipoCoche]: numero } })
                      }}
                    />
                  </td>
                )}
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
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-concreto/15 bg-white/35 px-5 py-3 font-body text-xs text-concreto sm:grid-cols-3">
        <span>Espesor posterior &gt; 0,3 mm</span>
        <span>Desgaste cóncavo ≤ 2,0 mm</span>
        <span>Rugosidad final R.A. = 2,5 µm</span>
      </div>
    </GlassSurface>
  )
}

function CampoCodigoTabla({ etiqueta, valor, opciones, disabled, onGuardar }: { etiqueta: string; valor: string; opciones: string[]; disabled: boolean; onGuardar: (valor: string) => void }) {
  const [borrador, setBorrador] = useSyncedState(valor)
  const listaId = `lista-${etiqueta.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <>
      <input
        aria-label={etiqueta}
        data-codigo-rodante="true"
        list={listaId}
        value={borrador}
        disabled={disabled}
        onChange={(evento) => setBorrador(evento.target.value)}
        onBlur={() => {
          const limpio = borrador.trim().toUpperCase()
          if (limpio && limpio !== valor) onGuardar(limpio)
        }}
        placeholder="Código"
        className="mt-1 w-full min-w-0 rounded-xl border border-concreto/20 bg-white/65 px-1.5 py-1 text-center font-data text-[0.68rem] text-emerald-800 outline-none focus:border-emerald-600/50 disabled:opacity-70"
      />
      <datalist id={listaId}>{opciones.map((opcion) => <option key={opcion} value={opcion} />)}</datalist>
    </>
  )
}

function ResumenDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-concreto/10 bg-white/45 px-3 py-2">
      <p className="font-body text-[0.6875rem] text-concreto">{etiqueta}</p>
      <p className="mt-0.5 font-data text-base font-semibold text-concreto-oscuro">
        {valor}
      </p>
    </div>
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
        rugosidadRa: RUGOSIDAD_RA_OBJETIVO,
      })
    }
  }

  return (
    <>
      <Campo
        valor={tAntes}
        onGuardar={(v) => guardar('reperfiladoTAntes', v)}
        disabled={deshabilitada}
        invalido={tAntes !== null && tAntes <= 0}
      />
      <Campo
        valor={hAntes}
        onGuardar={(v) => guardar('reperfiladoHAntes', v)}
        disabled={deshabilitada}
        invalido={hAntes !== null && hAntes > 2}
      />
      <Campo
        valor={t}
        onGuardar={(v) => guardar('tValue', v)}
        disabled={deshabilitada}
        invalido={(t !== null && t <= 0.3) || datos.tInvalido || datos.rdInvalido}
      />
      <Campo
        valor={h}
        onGuardar={(v) => guardar('hValue', v)}
        disabled={deshabilitada}
        invalido={(h !== null && h > 2) || datos.rdInvalido}
      />
      <Campo
        valor={datos.recordId || t !== null || h !== null ? RUGOSIDAD_RA_OBJETIVO : null}
        onGuardar={(v) => guardar('rugosidadRa', v)}
        disabled
        invalido={ra !== null && ra !== RUGOSIDAD_RA_OBJETIVO}
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
        data-reperfilado-invalido={invalido ? 'true' : undefined}
        step="0.01"
        disabled={disabled}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => {
          const n = Number(borrador)
          if (borrador !== '' && Number.isFinite(n) && n !== valor) onGuardar(n)
        }}
        placeholder="—"
        className={`glass-field w-full min-w-0 px-1.5 py-1 text-right font-data text-xs transition ${
          borrador === '' ? 'border-amber-500/25 bg-amber-50/25' : 'border-emerald-700/20 bg-emerald-50/30'
        } ${invalido ? 'border-[color:var(--color-estado-critico)]' : ''}`}
      />
    </td>
  )
}
