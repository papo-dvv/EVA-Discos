import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BotonVolverInicio } from '../components/BotonVolverInicio'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { PantallaFondo } from '../components/PantallaFondo'
import { SegmentedControl } from '../components/SegmentedControl'
import { WarningTooltip } from '../components/WarningTooltip'
import { CargaInicialFicha } from '../features/new-measurement/components/CargaInicialFicha'
import { ConteoEstadosFicha } from '../features/new-measurement/components/ConteoEstadosFicha'
import { FooterFicha } from '../features/new-measurement/components/FooterFicha'
import { HeaderFicha } from '../features/new-measurement/components/HeaderFicha'
import { ModalFilasConProblemas } from '../features/new-measurement/components/ModalFilasConProblemas'
import { ModalMedicionAnterior } from '../features/new-measurement/components/ModalMedicionAnterior'
import { TablaFichaEspejo } from '../features/new-measurement/components/TablaFichaEspejo'
import {
  useBloquearFicha,
  useCancelarFicha,
  useConfirmarFicha,
  useEditarFicha,
  useFichaPreview,
  useReferenciaFicha,
  useReiniciarFicha,
  useVerificarFicha,
} from '../features/new-measurement/queries'
import type { MotivoFicha, ResumenVerificacion } from '../features/new-measurement/types'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const MOTIVO_OPCIONES: {
  valor: MotivoFicha
  etiqueta: string
  deshabilitada?: boolean
  tooltip?: string
  tooltipPosicion?: 'arriba' | 'abajo'
}[] = [
  { valor: 'Medición', etiqueta: 'Medición' },
  { valor: 'Reperfilado', etiqueta: 'Reperfilado', deshabilitada: true, tooltip: 'Próximamente', tooltipPosicion: 'abajo' },
  { valor: 'Cambio', etiqueta: 'Cambio', deshabilitada: true, tooltip: 'Próximamente', tooltipPosicion: 'abajo' },
]

function valorConformidad(todasConformes: boolean | null): 'si' | 'no' | undefined {
  if (todasConformes === null) return undefined
  return todasConformes ? 'si' : 'no'
}

// Mensaje del tooltip de "Confirmar ficha" según cuál(es) de las condiciones
// obligatorias todavía falten (tabla bloqueada, Responsable de Mantenimiento,
// P.T. — punto 5 del enunciado agrega esta última).
function mensajeConfirmarBloqueado(tablaBloqueada: boolean, responsableVacio: boolean, ptVacio: boolean): string {
  const faltantes: string[] = []
  if (!tablaBloqueada) faltantes.push('bloquear la tabla de mediciones (Verificar → Bloquear Mediciones)')
  if (responsableVacio) faltantes.push('completar el Responsable de Mantenimiento')
  if (ptVacio) faltantes.push('completar el P.T. (Puesto de Trabajo)')
  return `Falta ${juntarConY(faltantes)} para poder confirmar la ficha.`
}

function juntarConY(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

// "✅ Ficha verificada — lista para bloquear." es EXCLUSIVO de
// todoValido=true — no se muestra incondicional según ficha.verificado sin
// más (dejaría sin mensaje específico el caso con problemas).
// resultadoVerificacion es la última response de /validate (ver estado de la
// página, se mantiene tras cerrar el modal) — con problemas, sólo las filas
// propias (t/rd) suman al conteo mostrado; un problema de sólo Kilometraje/
// Fecha (0 filas propias) tiene su propio mensaje, ya que esas 2 alertas
// viven en el header.
function mensajeEstadoVerificacion(
  tablaBloqueada: boolean,
  verificado: boolean,
  resultadoVerificacion: ResumenVerificacion | null,
): string {
  if (tablaBloqueada) return '🔒 Tabla de mediciones bloqueada.'
  if (resultadoVerificacion && !resultadoVerificacion.todoValido) {
    const n = resultadoVerificacion.filasExcluidas.length
    return n > 0
      ? `⚠ Ficha con ${n} fila(s) con problemas — corregí antes de continuar.`
      : '⚠ Corregí el Kilometraje o la Fecha del header antes de continuar.'
  }
  if (verificado) return '✅ Ficha verificada — lista para bloquear.'
  return 'Verifica la ficha antes de poder bloquear la tabla de mediciones.'
}

// Ficha de medición individual (punto 1-6 del enunciado). Una sola pantalla:
// sin fichaId en la URL se ve el toggle de Motivo + el punto de entrada
// (subir CSV / registrar manualmente); al crearse la ficha, la URL pasa a
// /nuevas-mediciones/:fichaId (mismo patrón que /migracion → /migracion/:fileId)
// y acá mismo se renderiza el formulario completo ya poblado.
export function NuevasMediciones() {
  const { fichaId } = useParams<{ fichaId?: string }>()
  const navigate = useNavigate()
  const [motivo, setMotivo] = useState<MotivoFicha | undefined>(fichaId ? 'Medición' : undefined)
  const [cancelando, setCancelando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [medicionAnteriorAbierta, setMedicionAnteriorAbierta] = useState(false)
  // Última response de /validate — se usa para el contenido del modal de
  // resultado Y para resaltarInvalidos de la tabla (ver más abajo). A
  // diferencia de antes, NO se limpia al cerrar el modal (ver modalAbierto):
  // solo la reemplaza una nueva verificación, o un reinicio de la ficha —
  // así "Corregir manualmente" puede cerrar el modal sin que la tabla pierda
  // el reordenamiento/resaltado que ese mismo resultado habilita.
  const [resultadoVerificacion, setResultadoVerificacion] = useState<ResumenVerificacion | null>(null)
  // Visibilidad del modal de resultado, independiente de resultadoVerificacion
  // (ver comentario arriba).
  const [modalAbierto, setModalAbierto] = useState(false)
  // fichaId pendiente de auto-verificar apenas termine de cargar (ver
  // manejarFichaCreada/efecto más abajo) — SOLO se setea desde el flujo de
  // carga por CSV (CargaInicialFicha.onCreada con autoVerificar=true), nunca
  // en modo manual. Vive en un ref (no en query param ni router state) para
  // no depender de cómo React Router decida remontar o no este componente
  // entre /nuevas-mediciones y /nuevas-mediciones/:fichaId.
  const autoVerificarPendiente = useRef<string | null>(null)

  const preview = useFichaPreview(fichaId ?? '', { page: 1, pageSize: 100 })
  const editarFicha = useEditarFicha(fichaId ?? '')
  const confirmarFicha = useConfirmarFicha(fichaId ?? '')
  const cancelarFicha = useCancelarFicha(fichaId ?? '')
  const verificarFicha = useVerificarFicha(fichaId ?? '')
  const bloquearFicha = useBloquearFicha(fichaId ?? '')
  const reiniciarFicha = useReiniciarFicha(fichaId ?? '')

  const ficha = preview.data?.ficha
  const rows = preview.data?.rows ?? []

  // Última medición confirmada de CADA disco de este tren (mismo GET
  // .../reference que alimenta el modal de "Medición Anterior") — acá se usa
  // como fuente del banner de Km/Fecha del header. Una sola query, cacheada
  // por React Query: si el usuario después abre "Medición Anterior" →
  // "Última Medición", no dispara un segundo fetch.
  const referencia = useReferenciaFicha(ficha?.trenNumero, 'ultima_medicion')
  // Narrowing manual con 'fecha' in ...: useReferenciaFicha es genérico en
  // TipoReferencia (el hook no liga el tipo de retorno al valor literal
  // pasado), así que TS no sabe por sí solo que ACÁ, con tipo='ultima_medicion'
  // fijo, el resultado nunca puede ser ReferenciaUltimaFicha.
  const referenciaDisponible =
    referencia.data?.disponible && 'fecha' in referencia.data ? referencia.data : undefined
  // Punto 3 del enunciado (fix): kmInvalido/fechaInvalido viajan ÚNICAMENTE a
  // nivel raíz de /preview (ver PreviewFichaResult, backend) — ya NO existen
  // por fila (PreviewRow ya no los tiene). Antes se derivaban con
  // rows.some(r => r.kmInvalido), que ahora siempre daría false.
  const kmInvalido = preview.data?.kmInvalido ?? null
  const fechaInvalido = preview.data?.fechaInvalido ?? null
  // trenOriginalCsv solo viaja no-nulo en fichas que vinieron de un CSV (ver
  // MeasurementSheet, backend) — reset() no lo toca, así que sigue siendo la
  // forma correcta de distinguir el origen incluso DESPUÉS de reiniciar.
  const esOrigenCsv = ficha?.trenOriginalCsv !== null
  // Ficha de origen CSV con 0 filas: dado que la tabla no expone ninguna
  // acción para borrar una fila individual (agregarFila/editarFila son las
  // únicas mutaciones que la UI dispara sobre records), la ÚNICA forma de que
  // una ficha CSV llegue a 0 filas es a través de un reset — condición
  // derivada del propio estado persistido (no un flag de sesión aparte), así
  // que sigue siendo correcta después de recargar la página.
  const mostrarPromptRecarga = esOrigenCsv && rows.length === 0

  async function confirmar() {
    await confirmarFicha.mutateAsync()
    navigate('/mediciones', { replace: true })
  }

  async function cancelar() {
    await cancelarFicha.mutateAsync()
    navigate('/nuevas-mediciones', { replace: true })
  }

  function verificar() {
    verificarFicha.mutate(undefined, {
      onSuccess: (resumen) => {
        setResultadoVerificacion(resumen)
        setModalAbierto(true)
      },
    })
  }

  async function reiniciar() {
    await reiniciarFicha.mutateAsync()
    setResultadoVerificacion(null)
  }

  // onCreada de CargaInicialFicha (carga inicial y reupload tras un reset):
  // navega a la ficha recién creada y, si vino de un CSV (autoVerificar),
  // marca su id como pendiente — el efecto de abajo dispara la misma
  // verificación que un click manual en "Verificar" apenas la URL cambia a
  // ese fichaId, sin esperar a que el usuario la pida.
  function manejarFichaCreada(id: string, autoVerificar = false, opciones?: { replace?: boolean }) {
    if (autoVerificar) autoVerificarPendiente.current = id
    navigate(`/nuevas-mediciones/${id}`, opciones)
  }

  // Dispara UNA sola vez por ficha (guardado en el propio ref, que se limpia
  // apenas se consume) — no depende de que `preview` ya haya cargado: verificar()
  // solo necesita el fichaId, ya disponible desde la URL.
  useEffect(() => {
    if (!fichaId || autoVerificarPendiente.current !== fichaId) return
    autoVerificarPendiente.current = null
    verificar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaId])

  const responsableVacio = !ficha?.responsableMantenimientoNombre?.trim()
  const ptVacio = !ficha?.ptCodigo?.trim()
  const tablaBloqueada = ficha?.tablaBloqueada ?? false
  const puedeConfirmar = tablaBloqueada && !responsableVacio && !ptVacio

  // Punto 1 de la ampliación: la vista previa de la ficha (una vez creada)
  // usa un layout full-bleed, sin los márgenes/max-width habituales del
  // resto de la app — le da a la tabla el máximo espacio horizontal
  // disponible. La pantalla de entrada (motivo + CargaInicialFicha, sin
  // fichaId todavía) conserva el layout centrado de siempre.
  const contenedorAncho = fichaId ? 'w-full' : 'mx-auto max-w-[75rem]'

  return (
    <PantallaFondo className={fichaId ? 'px-2 py-4 sm:px-3' : 'px-3 py-6 sm:px-5'}>
      <div className={contenedorAncho}>
        <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
              Nuevas mediciones
            </h1>
            <p className="mt-0.5 font-body text-sm text-concreto">Registro de una ficha de medición individual</p>
          </div>
          <BotonVolverInicio />
        </GlassSurface>

        {/* Fuera de cualquier GlassSurface a propósito: esas tarjetas usan
            overflow:hidden (styles.md §4) y recortarían el WarningTooltip
            "Próximamente" de Reperfilado/Cambio, que no tiene margen para
            asomar dentro de una tarjeta tan compacta. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Motivo</p>
          <SegmentedControl
            ariaLabel="Motivo de la ficha"
            opciones={MOTIVO_OPCIONES}
            valor={motivo}
            onCambiar={setMotivo}
          />
        </div>

        {motivo === 'Medición' && !fichaId && (
          <GlassSurface fuerte className="mt-4 rounded-glass-lg p-6 sm:p-8">
            <CargaInicialFicha onCreada={(id, autoVerificar) => manejarFichaCreada(id, autoVerificar)} />
          </GlassSurface>
        )}

        {fichaId && (
          <>
            {preview.isLoading ? (
              <p className="mt-6 font-body text-sm text-concreto">Cargando ficha…</p>
            ) : preview.isError ? (
              <p role="alert" className="mt-6 font-body text-sm text-[color:var(--color-estado-critico)]">
                {extraerMensajeError(preview.error)}
              </p>
            ) : preview.data && ficha ? (
              <>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <GlassButton
                    type="button"
                    variante="secundario"
                    onClick={() => setMedicionAnteriorAbierta(true)}
                    className="text-xs"
                  >
                    Medición anterior
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variante="secundario"
                    onClick={() => setCancelando(true)}
                    disabled={cancelarFicha.isPending}
                    className="text-xs"
                    style={{ borderColor: 'var(--color-estado-critico)', color: 'var(--color-estado-critico)' }}
                  >
                    Cancelar ficha
                  </GlassButton>
                </div>

                {mostrarPromptRecarga ? (
                  <GlassSurface fuerte className="mt-3 rounded-glass-lg p-6 sm:p-8">
                    <p className="mb-4 font-body text-sm text-concreto">
                      La ficha se reinició — subí un nuevo archivo .csv para continuar (o cambiá a registro manual).
                    </p>
                    <CargaInicialFicha
                      onCreada={(id, autoVerificar) => manejarFichaCreada(id, autoVerificar, { replace: true })}
                    />
                  </GlassSurface>
                ) : (
                  <>
                    {/* Punto 6 de la ampliación: la card de Verificar (botón +
                        mensaje de resultado) queda DEBAJO del toggle Medición
                        Anterior/Cancelar Ficha de arriba, ANTES del header y
                        la tabla — así el estado de verificación y las 5 cards
                        de conteo (ver ConteoEstadosFicha) quedan siempre
                        visibles apenas se entra a la ficha, sin tener que
                        bajar hasta después de la tabla. */}
                    <GlassSurface fuerte className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4">
                      <p className="font-body text-sm text-concreto-oscuro">
                        {mensajeEstadoVerificacion(tablaBloqueada, ficha.verificado, resultadoVerificacion)}
                      </p>
                      {!tablaBloqueada && (
                        <GlassButton
                          type="button"
                          variante="secundario"
                          onClick={verificar}
                          cargando={verificarFicha.isPending}
                          className="text-xs"
                        >
                          Verificar
                        </GlassButton>
                      )}
                    </GlassSurface>

                    <ConteoEstadosFicha rows={rows} />

                    <GlassSurface fuerte className="mt-4 rounded-glass-lg p-5 sm:p-6">
                      <HeaderFicha
                        ficha={ficha}
                        onGuardar={(c) => editarFicha.mutate(c)}
                        deshabilitada={tablaBloqueada}
                        kmInvalido={kmInvalido}
                        fechaInvalido={fechaInvalido}
                        referencia={referenciaDisponible}
                      />
                    </GlassSurface>

                    <TablaFichaEspejo
                      fichaId={fichaId}
                      esqueleto={preview.data.esqueleto}
                      rows={rows}
                      deshabilitada={tablaBloqueada}
                      resaltarInvalidos={resultadoVerificacion !== null}
                    />

                    <GlassSurface fuerte className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4">
                      <p className="font-body text-sm font-semibold text-concreto-oscuro">
                        ¿Todas las medidas conformes?
                      </p>
                      <SegmentedControl
                        ariaLabel="Todas las medidas conformes"
                        opciones={[
                          { valor: 'si', etiqueta: 'Sí' },
                          { valor: 'no', etiqueta: 'No' },
                        ]}
                        valor={valorConformidad(ficha.todasConformes)}
                        onCambiar={(v) => editarFicha.mutate({ todasConformes: v === 'si' })}
                      />
                    </GlassSurface>

                    {/* Punto 4 del enunciado: el footer ya no se monta en absoluto
                        hasta que la tabla está bloqueada — antes se mostraba gris
                        con un tooltip explicando por qué. */}
                    {tablaBloqueada && <FooterFicha ficha={ficha} onGuardar={(c) => editarFicha.mutate(c)} />}

                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <WarningTooltip texto="Disponible próximamente">
                        <GlassButton type="button" aria-disabled="true" className="cursor-not-allowed opacity-60">
                          Descargar PDF
                        </GlassButton>
                      </WarningTooltip>

                      {puedeConfirmar ? (
                        <GlassButton
                          type="button"
                          onClick={() => setConfirmando(true)}
                          cargando={confirmarFicha.isPending}
                        >
                          Confirmar ficha
                        </GlassButton>
                      ) : (
                        // aria-disabled (no `disabled`): igual criterio que
                        // SegmentedControl — un botón nativo disabled no deja que
                        // el WarningTooltip que lo envuelve reciba hover/foco.
                        <WarningTooltip texto={mensajeConfirmarBloqueado(tablaBloqueada, responsableVacio, ptVacio)}>
                          <GlassButton type="button" aria-disabled="true" className="cursor-not-allowed opacity-60">
                            Confirmar ficha
                          </GlassButton>
                        </WarningTooltip>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </div>

      {cancelando && (
        <ConfirmDialog
          titulo="Cancelar ficha"
          variante="danger"
          textoConfirmar="Sí, cancelar ficha"
          textoCancelar="Volver"
          onConfirm={cancelar}
          onCerrar={() => setCancelando(false)}
          mensaje="Esto elimina la ficha y todas sus mediciones. Esta acción no se puede deshacer."
        />
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar ficha"
          textoConfirmar="Sí, confirmar"
          onConfirm={confirmar}
          onCerrar={() => setConfirmando(false)}
          mensaje="¿Confirmar y guardar esta ficha en base de datos? Después no podrás seguir editándola."
        />
      )}

      {/* 2 modales DISTINTOS según el resultado de /validate, no uno solo con
          textos condicionales: todoValido=true es Bloquear Mediciones/
          Cancelar; con filas con problemas, el modal cambia por completo
          (ModalFilasConProblemas, con Corregir manualmente/Resubir CSV o
          Reiniciar ficha — el modelo es binario, no existe "bloquear igual,
          se confirman solo las filas válidas"). */}
      {modalAbierto && resultadoVerificacion && resultadoVerificacion.todoValido && (
        <ConfirmDialog
          titulo="Todos los datos están OK"
          mensaje="¿Bloquear la tabla de mediciones? La tabla y el header (Fecha/Tren/Kilometraje/P.T.) pasan a solo lectura y se habilita el footer."
          textoConfirmar="Bloquear Mediciones"
          textoCancelar="Cancelar"
          motivoConfirmarDeshabilitado={
            ptVacio
              ? 'Completa el P.T. (Puesto de Trabajo) en el header para poder bloquear la tabla de mediciones.'
              : null
          }
          onConfirm={async () => {
            await bloquearFicha.mutateAsync()
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {modalAbierto && resultadoVerificacion && !resultadoVerificacion.todoValido && (
        <ModalFilasConProblemas
          resumen={resultadoVerificacion}
          esOrigenCsv={esOrigenCsv}
          onCorregir={() => setModalAbierto(false)}
          onReiniciar={reiniciar}
        />
      )}

      {medicionAnteriorAbierta && ficha && (
        <ModalMedicionAnterior
          fichaId={fichaId!}
          trenNumero={ficha.trenNumero}
          onCerrar={() => setMedicionAnteriorAbierta(false)}
        />
      )}
    </PantallaFondo>
  )
}
