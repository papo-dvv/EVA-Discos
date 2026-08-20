import { useMemo, useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { construirFilasEspejo, type LadoFilaEspejo } from '../filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import type { CambiosFicha, CodigosBogie, CodigosCoche, PosicionEsqueleto, PreviewRow, TipoCoche } from '../types'

type Lado = 'izquierdo' | 'derecho'

type AlertaReperfilado = {
  id: string
  severidad: 'critica' | 'advertencia'
  eje: number
  lado: Lado
  mensaje: string
}

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
  const ladoTocado = (lado: LadoFilaEspejo) =>
    lado.recordId !== null ||
    lado.reperfiladoTAntes !== null ||
    lado.reperfiladoHAntes !== null ||
    lado.tValue !== null ||
    lado.hValue !== null ||
    lado.rugosidadRa !== null
  const ladoCompleto = (lado: LadoFilaEspejo) =>
    !ladoTocado(lado) ||
    lado.reperfiladoTAntes !== null &&
    lado.reperfiladoHAntes !== null &&
    lado.tValue !== null &&
    lado.hValue !== null &&
    (lado.rugosidadRa !== null || lado.recordId !== null)
  const ladoMedido = (lado: LadoFilaEspejo) => ladoTocado(lado) && ladoCompleto(lado)
  const ladosCompletos = filas.reduce(
    (total, fila) =>
      total + Number(ladoMedido(fila.izquierdo)) + Number(ladoMedido(fila.derecho)),
    0,
  )
  const ladosTocados = filas.reduce(
    (total, fila) =>
      total + Number(ladoTocado(fila.izquierdo)) + Number(ladoTocado(fila.derecho)),
    0,
  )
  const ladosPendientes = filas.reduce(
    (total, fila) =>
      total +
      Number(ladoTocado(fila.izquierdo) && !ladoCompleto(fila.izquierdo)) +
      Number(ladoTocado(fila.derecho) && !ladoCompleto(fila.derecho)),
    0,
  )
  const porcentaje = ladosTocados
    ? Math.round((ladosCompletos / ladosTocados) * 100)
    : 0
  const fueraDeLimite = filas.reduce((total, fila) => {
    const lados = [fila.izquierdo, fila.derecho]
    return total + lados.filter((lado) =>
      (lado.reperfiladoTAntes !== null && lado.tValue !== null && lado.tValue >= lado.reperfiladoTAntes) ||
      (lado.reperfiladoHAntes !== null && lado.hValue !== null && lado.hValue >= lado.reperfiladoHAntes) ||
      (lado.recordId !== null && lado.rugosidadRa !== RUGOSIDAD_RA_OBJETIVO) ||
      lado.tInvalido || lado.rdInvalido,
    ).length
  }, 0)
  const alertas = useMemo<AlertaReperfilado[]>(() => {
    const resultado: AlertaReperfilado[] = []
    for (const fila of filas) {
      for (const [lado, datos] of [
        ['izquierdo', fila.izquierdo],
        ['derecho', fila.derecho],
      ] as const) {
        if (!ladoTocado(datos)) continue
        const posicion = `Eje ${fila.ejeNumero}, lado ${lado}`
        if (!ladoCompleto(datos)) {
          resultado.push({
            id: `${fila.ejeNumero}-${lado}-incompleto`,
            severidad: 'advertencia',
            eje: fila.ejeNumero,
            lado,
            mensaje: `${posicion}: faltan mediciones por completar.`,
          })
        }
        if (datos.reperfiladoTAntes !== null && datos.tValue !== null && datos.tValue >= datos.reperfiladoTAntes) {
          resultado.push({
            id: `${fila.ejeNumero}-${lado}-espesor`,
            severidad: 'critica',
            eje: fila.ejeNumero,
            lado,
            mensaje: `${posicion}: el espesor posterior no disminuye.`,
          })
        }
        if (datos.reperfiladoHAntes !== null && datos.hValue !== null && datos.hValue >= datos.reperfiladoHAntes) {
          resultado.push({
            id: `${fila.ejeNumero}-${lado}-concavo`,
            severidad: 'critica',
            eje: fila.ejeNumero,
            lado,
            mensaje: `${posicion}: el cóncavo posterior no disminuye.`,
          })
        }
        if (datos.recordId !== null && datos.rugosidadRa !== RUGOSIDAD_RA_OBJETIVO) {
          resultado.push({
            id: `${fila.ejeNumero}-${lado}-rugosidad`,
            severidad: 'critica',
            eje: fila.ejeNumero,
            lado,
            mensaje: `${posicion}: la rugosidad final no es 2,5 µm.`,
          })
        }
        if (datos.tInvalido || datos.rdInvalido) {
          resultado.push({
            id: `${fila.ejeNumero}-${lado}-historial`,
            severidad: 'critica',
            eje: fila.ejeNumero,
            lado,
            mensaje: `${posicion}: contradice la medición confirmada anterior.`,
          })
        }
      }
    }
    return resultado
  }, [filas])
  const ejesConAlertas = new Set(alertas.map((alerta) => alerta.eje))
  const criticas = alertas.filter((alerta) => alerta.severidad === 'critica').length
  const codigosCocheFaltantes = TIPOS_COCHE.filter((tipo) => !codigosCoche?.[tipo]).length
  const codigosBogieFaltantes = filas
    .filter((fila) => (fila.ejeNumero - 1) % 2 === 0)
    .filter((fila) => !codigosBogie?.[`${fila.tipoCoche}:${fila.bogieCodigo}`]).length
  const filasVisibles = soloPendientes
    ? filas.filter(
        (fila) =>
          (ladoTocado(fila.izquierdo) && !ladoCompleto(fila.izquierdo)) ||
          (ladoTocado(fila.derecho) && !ladoCompleto(fila.derecho)) ||
          ejesConAlertas.has(fila.ejeNumero),
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
            {soloPendientes ? 'Mostrando alertas' : 'Ver solo alertas'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ResumenDato etiqueta="Medidos" valor={String(ladosCompletos)} />
          <ResumenDato etiqueta="Pendientes" valor={String(ladosPendientes)} />
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
        {(ladosPendientes > 0 || fueraDeLimite > 0) && (
          <div role="alert" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-2xl border border-amber-600/20 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
            {ladosPendientes > 0 && <span>⚠ Hay {ladosPendientes} posición(es) iniciadas sin completar.</span>}
            {fueraDeLimite > 0 && <span>⚠ {fueraDeLimite} posiciones necesitan revisión.</span>}
          </div>
        )}
        <div className="mt-3 rounded-2xl border border-concreto/10 bg-white/50 p-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-concreto-oscuro">
                Asistente preventivo
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-concreto">
                Revisa la ficha mientras trabajas y te lleva directo a cada incidencia.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[0.6875rem] font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${criticas ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {criticas} críticas
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                {alertas.length - criticas} advertencias
              </span>
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
                {codigosCocheFaltantes + codigosBogieFaltantes} códigos pendientes
              </span>
            </div>
          </div>
          {alertas.length > 0 ? (
            <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {alertas.map((alerta) => (
                <button
                  key={alerta.id}
                  type="button"
                  onClick={() => {
                    const destino = document.querySelector<HTMLElement>(`[data-reperfilado-posicion="${alerta.eje}-${alerta.lado}"]`)
                    destino?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    destino?.querySelector<HTMLInputElement>('input[data-reperfilado-invalido="true"], input:not(:disabled)')?.focus()
                  }}
                  className={`rounded-xl border px-2.5 py-1 text-left text-[0.6875rem] transition hover:-translate-y-px ${
                    alerta.severidad === 'critica'
                      ? 'border-red-300/60 bg-red-50 text-red-800'
                      : 'border-amber-300/60 bg-amber-50 text-amber-900'
                  }`}
                >
                  {alerta.severidad === 'critica' ? '⛔' : '⚠'} {alerta.mensaje}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-emerald-800">
              ✓ No se detectan inconsistencias en las posiciones ingresadas.
            </p>
          )}
        </div>
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

  function guardar(
    campo:
      | 'tValue'
      | 'hValue'
      | 'reperfiladoTAntes'
      | 'reperfiladoHAntes',
    valor: number,
  ) {
    if (campo === 'tValue') setT(valor)
    if (campo === 'hValue') setH(valor)
    if (campo === 'reperfiladoTAntes') setTAntes(valor)
    if (campo === 'reperfiladoHAntes') setHAntes(valor)
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
    <td
      colSpan={5}
      data-reperfilado-posicion={`${eje}-${lado}`}
      className="p-0"
    >
      <div className="grid grid-cols-5">
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
        invalido={(tAntes !== null && t !== null && t >= tAntes) || datos.tInvalido || datos.rdInvalido}
      />
      <Campo
        valor={h}
        onGuardar={(v) => guardar('hValue', v)}
        disabled={deshabilitada}
        invalido={(hAntes !== null && h !== null && h >= hAntes) || datos.rdInvalido}
      />
      <Campo
        valor={datos.recordId || t !== null || h !== null ? RUGOSIDAD_RA_OBJETIVO : null}
        onGuardar={() => undefined}
        disabled
        invalido={datos.recordId !== null && datos.rugosidadRa !== RUGOSIDAD_RA_OBJETIVO}
      />
      </div>
    </td>
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
    <div className="px-1.5 py-1">
      <input
        type="number"
        data-reperfilado-invalido={invalido ? 'true' : undefined}
        aria-invalid={invalido || undefined}
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
    </div>
  )
}
