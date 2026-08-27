import { useMemo } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { construirFilasEspejo, type LadoFilaEspejo } from '../filaEspejo'
import { useAgregarFilaFicha, useEditarFilaFicha } from '../queries'
import type {
  CodigosBogie,
  EstadoDisco,
  FilaExcluidaVerificacion,
  MotivoInvalido,
  PosicionEsqueleto,
  PreviewRow,
} from '../types'

type Lado = 'izquierdo' | 'derecho'

type Props = {
  fichaId: string
  esqueleto: PosicionEsqueleto[]
  rows: PreviewRow[]
  codigosBogie: CodigosBogie | null
  deshabilitada?: boolean
  // true recién después de "Verificar" — mismo criterio que TablaFichaEspejo:
  // no se resalta nada hasta que el usuario pidió explícitamente validar.
  resaltarInvalidos?: boolean
  filasExcluidasVerificacion?: FilaExcluidaVerificacion[]
}

const RUGOSIDAD_RA_OBJETIVO = 2.5

function serieBogie(codigo: string): string {
  return codigo.includes('/')
    ? (codigo.split('/').at(-1)?.trim() ?? codigo)
    : codigo
}

// Ficha UT-UF-MTO-FR-414 adaptada al lenguaje visual del proyecto: conserva
// la lectura espejo del tren y separa explícitamente valores antes/después.
// Bogie/código y Coche son SIEMPRE automáticos (se resuelven por tren, igual
// que en Medición — ver TablaFichaEspejo) — no se editan desde esta tabla.
export function TablaFichaReperfilado({
  fichaId,
  esqueleto,
  rows,
  codigosBogie,
  deshabilitada = false,
  resaltarInvalidos = false,
  filasExcluidasVerificacion = [],
}: Props) {
  const filas = useMemo(
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
  const ladosPendientes = filas.reduce(
    (total, fila) =>
      total +
      Number(ladoTocado(fila.izquierdo) && !ladoCompleto(fila.izquierdo)) +
      Number(ladoTocado(fila.derecho) && !ladoCompleto(fila.derecho)),
    0,
  )
  const fueraDeLimite = filas.reduce((total, fila) => {
    const lados = [fila.izquierdo, fila.derecho]
    return total + lados.filter((lado) =>
      (lado.reperfiladoTAntes !== null && lado.tValue !== null && lado.tValue >= lado.reperfiladoTAntes) ||
      (lado.reperfiladoHAntes !== null && lado.hValue !== null && lado.hValue >= lado.reperfiladoHAntes) ||
      (lado.recordId !== null && lado.rugosidadRa !== RUGOSIDAD_RA_OBJETIVO) ||
      lado.tInvalido || lado.rdInvalido,
    ).length
  }, 0)
  function motivosVisiblesLado(lado: LadoFilaEspejo): MotivoInvalido[] {
    return (
      (lado.recordId ? motivosVerificadosPorRecord.get(lado.recordId) : undefined) ??
      lado.motivos
    )
  }
  const mostrarColumnaMotivo =
    resaltarInvalidos &&
    filas.some(
      (fila) =>
        motivosVisiblesLado(fila.izquierdo).length > 0 ||
        motivosVisiblesLado(fila.derecho).length > 0,
    )

  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass">
      <div className="border-b border-concreto/15 bg-white/35 px-5 py-3">
        <div>
          <h2 className="font-display text-base font-semibold text-concreto-oscuro">
            Control disco de freno
          </h2>
          <p className="mt-0.5 font-body text-xs text-concreto">
            Completa las cinco mediciones de cada lado tal como aparecen en
            la ficha física, incluida la rugosidad R.A. Bogie/código y
            Coche se completan automáticamente según el tren.
          </p>
        </div>
        {(ladosPendientes > 0 || fueraDeLimite > 0) && (
          <div role="alert" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-2xl border border-amber-600/20 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
            {ladosPendientes > 0 && <span>⚠ Hay {ladosPendientes} posición(es) iniciadas sin completar.</span>}
            {fueraDeLimite > 0 && <span>⚠ {fueraDeLimite} posiciones necesitan revisión.</span>}
          </div>
        )}
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[76rem] table-fixed border-collapse font-body text-xs">
          <colgroup>
            {mostrarColumnaMotivo && <col className="w-[10%]" />}
            <col className="w-[6.5%]" />
            {Array.from({ length: 5 }, (_, indice) => (
              <col key={`izq-${indice}`} className="w-[6.6%]" />
            ))}
            <col className="w-[5.5%]" />
            <col className="w-[3.5%]" />
            <col className="w-[3.5%]" />
            <col className="w-[6.5%]" />
            <col className="w-[3.5%]" />
            <col className="w-[3.5%]" />
            {Array.from({ length: 5 }, (_, indice) => (
              <col key={`der-${indice}`} className="w-[6.6%]" />
            ))}
            <col className="w-[5.5%]" />
          </colgroup>
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="border-b border-concreto/20 bg-[color:var(--color-arena-suave)]">
              {mostrarColumnaMotivo && (
                <th rowSpan={3} className="px-2 py-2 text-left">
                  Motivo/Inválido
                </th>
              )}
              <th rowSpan={3} className="px-2 py-2 text-left">
                Bogie / código
              </th>
              <th colSpan={6} className="px-2 py-2 text-center">
                Disco lado izquierdo
              </th>
              <th rowSpan={3} className="px-2 py-2 text-center">
                Eje
              </th>
              <th rowSpan={3} className="px-2 py-2 text-center">
                Rueda
              </th>
              <th rowSpan={3} className="px-3 py-2 text-center">
                Coche
              </th>
              <th rowSpan={3} className="px-2 py-2 text-center">
                Rueda
              </th>
              <th rowSpan={3} className="px-2 py-2 text-center">
                Eje
              </th>
              <th colSpan={6} className="px-2 py-2 text-center">
                Disco lado derecho
              </th>
            </tr>
            <tr className="border-b border-concreto/15 bg-white/55 text-concreto">
              <th colSpan={2} className="px-2 py-1.5 text-center">
                Antes del reperfilado
              </th>
              <th colSpan={4} className="px-2 py-1.5 text-center">
                Después del reperfilado
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center">
                Antes del reperfilado
              </th>
              <th colSpan={4} className="px-2 py-1.5 text-center">
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
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="px-2 py-2">Espesor (mm)</th>
              <th className="px-2 py-2">Cóncavo (mm)</th>
              <th className="border-l-2 border-concreto/25 px-2 py-2">
                R.A. (µm)
              </th>
              <th className="px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const motivosIzq = motivosVisiblesLado(fila.izquierdo)
              const motivosDer = motivosVisiblesLado(fila.derecho)
              const hayMotivo = motivosIzq.length > 0 || motivosDer.length > 0
              return (
                <tr
                  key={fila.ejeNumero}
                  className={`tabla-fila--glass border-b border-concreto/10 ${
                    (fila.ejeNumero - 1) % 4 === 0
                      ? 'border-t-4 border-t-concreto/30'
                      : ''
                  }`}
                >
                  {mostrarColumnaMotivo && (
                    <td className="break-words px-2 py-1.5 align-top">
                      {hayMotivo ? (
                        <WarningTooltip
                          texto={[
                            motivosIzq.length > 0
                              ? `Izq: ${motivosIzq.map((m) => m.motivo).join('; ')}`
                              : null,
                            motivosDer.length > 0
                              ? `Der: ${motivosDer.map((m) => m.motivo).join('; ')}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' — ')}
                          className="block"
                        >
                          <span className="block cursor-help space-y-1 whitespace-normal text-pretty font-body text-xs leading-snug">
                            {motivosIzq.length > 0 && (
                              <span className="block">
                                <span className="font-semibold text-[color:var(--color-estado-critico)]">
                                  Izq:
                                </span>{' '}
                                {motivosIzq.map((m) => m.motivo).join('; ')}
                              </span>
                            )}
                            {motivosDer.length > 0 && (
                              <span className="block">
                                <span className="font-semibold text-[color:var(--color-estado-critico)]">
                                  Der:
                                </span>{' '}
                                {motivosDer.map((m) => m.motivo).join('; ')}
                              </span>
                            )}
                          </span>
                        </WarningTooltip>
                      ) : (
                        <span className="font-body text-xs text-concreto">—</span>
                      )}
                    </td>
                  )}
                  {(fila.ejeNumero - 1) % 2 === 0 && (
                    <td rowSpan={2} className="px-2 py-1.5 align-middle font-semibold text-concreto-oscuro">
                      <span className="block whitespace-nowrap">
                        {fila.bogieCodigo}
                        {(() => {
                          const codigo = codigosBogie?.[`${fila.tipoCoche}:${fila.bogieCodigo}`]
                          return codigo ? (
                            <span className="text-concreto"> · {serieBogie(codigo)}</span>
                          ) : null
                        })()}
                      </span>
                    </td>
                  )}
                  <LadoReperfilado
                    fichaId={fichaId}
                    eje={fila.ejeNumero}
                    lado="izquierdo"
                    datos={fila.izquierdo}
                    deshabilitada={deshabilitada}
                  />
                  <CeldaEstado estado={fila.izquierdo.estadoCalculado} />
                  <td className="px-2 py-1.5 text-center font-data text-concreto-oscuro">
                    {fila.ejeNumero}
                  </td>
                  <td className="px-2 py-1.5 text-center font-data text-concreto-oscuro">
                    {fila.izquierdo.ruedaNumero}
                  </td>
                  {(fila.ejeNumero - 1) % 4 === 0 && (
                    <td
                      rowSpan={4}
                      className="border-x-2 border-concreto/20 bg-white/55 px-3 py-1.5 text-center align-middle font-semibold text-concreto-oscuro"
                    >
                      <span className="block text-sm">{fila.tipoCoche}</span>
                      {fila.numeroCoche !== null && (
                        <span className="text-concreto">{fila.numeroCoche}</span>
                      )}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-center font-data text-concreto-oscuro">
                    {fila.derecho.ruedaNumero}
                  </td>
                  <td className="px-2 py-1.5 text-center font-data text-concreto-oscuro">
                    {fila.ejeNumero}
                  </td>
                  <LadoReperfilado
                    fichaId={fichaId}
                    eje={fila.ejeNumero}
                    lado="derecho"
                    datos={fila.derecho}
                    deshabilitada={deshabilitada}
                  />
                  <CeldaEstado estado={fila.derecho.estadoCalculado} />
                </tr>
              )
            })}
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

// Mismas clases .tabla-chip/.tabla-chip--{estado} de TablaFichaEspejo — el
// estado ya viene calculado por el backend a partir de T/H "después" (ver
// clasificarEstadoConReperfilado, backend/único origen de verdad): acá solo
// se muestra. "----" (no "—") en una posición sin T/H registrados todavía,
// tal como se pidió para distinguir "sin dato" de un chip de estado.
const CLASE_CHIP_ESTADO: Record<EstadoDisco, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

function CeldaEstado({ estado }: { estado: EstadoDisco | null }) {
  return (
    <td className="whitespace-nowrap px-1.5 py-1 text-center">
      {estado ? (
        <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>{estado}</span>
      ) : (
        <span className="font-body text-xs text-concreto">----</span>
      )}
    </td>
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
    <>
      <Campo
        valor={tAntes}
        onGuardar={(v) => guardar('reperfiladoTAntes', v)}
        disabled={deshabilitada}
        invalido={datos.antesInvalido}
      />
      <Campo
        valor={hAntes}
        onGuardar={(v) => guardar('reperfiladoHAntes', v)}
        disabled={deshabilitada}
        invalido={datos.antesInvalido}
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
  // Bloqueada: gris neutro, sin importar si tiene valor o no — el
  // ámbar/esmeralda de abajo es una pista de "esto se llena a mano" y no
  // tiene sentido mostrarla sobre un campo que ya no se puede editar.
  let claseCampo = 'border-concreto/15 bg-white/25 opacity-70'
  if (!disabled) {
    claseCampo = borrador === '' ? 'border-amber-500/25 bg-amber-50/25' : 'border-emerald-700/20 bg-emerald-50/30'
  }
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
        className={`glass-field w-full min-w-0 px-1.5 py-1 text-right font-data text-xs transition ${claseCampo} ${invalido ? 'border-[color:var(--color-estado-critico)]' : ''}`}
      />
    </td>
  )
}
