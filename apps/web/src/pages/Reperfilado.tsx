import { useEffect, useRef, useState } from 'react'
import { ClipboardPenLine, Download, RefreshCcw, Ruler, TriangleAlert } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { SegmentedControl } from '../components/SegmentedControl'
import { EVENTO_COLAPSAR_SIDEBAR } from '../components/Sidebar'
import { WarningTooltip } from '../components/WarningTooltip'
import { ConteoEstadosFicha } from '../features/new-measurement/components/ConteoEstadosFicha'
import { FooterFicha } from '../features/new-measurement/components/FooterFicha'
import { ModalMedicionAnterior } from '../features/new-measurement/components/ModalMedicionAnterior'
import { PanelHistorialMediciones } from '../features/new-measurement/components/PanelHistorialMediciones'
import { TablaFichaReperfilado } from '../features/new-measurement/components/TablaFichaReperfilado'
import {
  useBloquearFicha,
  useCancelarFicha,
  useConfirmarFicha,
  useEditarFicha,
  useFichaPreview,
  useVerificarFicha,
} from '../features/new-measurement/queries'
import { descargarPdfReperfilado } from '../features/new-measurement/api'
import {
  guardarFichaActiva,
  limpiarFichaActiva,
  obtenerFichaActiva,
} from '../features/new-measurement/fichaActiva'
import type {
  FichaInstrumento,
  MotivoFicha,
  ResumenVerificacion,
} from '../features/new-measurement/types'
import { CargaInicialReperfilado } from '../features/reprofiling/CargaInicialReperfilado'
import { HeaderReperfilado } from '../features/reprofiling/HeaderReperfilado'
import { extraerMensajeError } from '../lib/extraerMensajeError'

const MOTIVO_OPCIONES: {
  valor: MotivoFicha
  etiqueta: string
  icono: React.ReactNode
  deshabilitada?: boolean
  tooltip?: string
  tooltipPosicion?: 'arriba' | 'abajo'
}[] = [
  {
    valor: 'Medición',
    etiqueta: 'Medición',
    icono: <Ruler size={15} aria-hidden />,
  },
  {
    valor: 'Reperfilado',
    etiqueta: 'Reperfilado',
    icono: <RefreshCcw size={15} aria-hidden />,
  },
  {
    valor: 'Cambio',
    etiqueta: 'Cambio',
    icono: <ClipboardPenLine size={15} aria-hidden />,
    deshabilitada: true,
    tooltip: 'Próximamente',
    tooltipPosicion: 'abajo',
  },
]

function valorConformidad(todasConformes: boolean | null): 'si' | 'no' | undefined {
  if (todasConformes === null) return undefined
  return todasConformes ? 'si' : 'no'
}

function juntarConY(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

function problemaInstrumentos(instrumentos: FichaInstrumento[], fechaVerificacion: string): string | null {
  const fecha = fechaVerificacion.slice(0, 10)
  for (const instrumento of instrumentos) {
    const valores = [
      instrumento.codigo,
      instrumento.descripcion,
      instrumento.modeloMarca,
      instrumento.fechaCalibracion,
      instrumento.fechaVencimientoCalibracion,
      instrumento.observaciones,
    ].map((valor) => valor?.trim() ?? '')
    if (valores.some(Boolean) && valores.some((valor) => !valor)) {
      return `completar todos los campos del instrumento ${instrumento.posicion} o dejar esa fila vacía`
    }
    if (instrumento.fechaVencimientoCalibracion && instrumento.fechaVencimientoCalibracion.slice(0, 10) < fecha) {
      return `corregir el vencimiento del instrumento ${instrumento.posicion}; no puede ser anterior a la fecha de verificación`
    }
    if (
      instrumento.fechaCalibracion &&
      instrumento.fechaVencimientoCalibracion &&
      instrumento.fechaVencimientoCalibracion.slice(0, 10) < instrumento.fechaCalibracion.slice(0, 10)
    ) {
      return `corregir el vencimiento del instrumento ${instrumento.posicion}; no puede ser anterior a la fecha de calibración`
    }
  }
  return null
}

function mensajeConfirmarBloqueado(
  tablaBloqueada: boolean,
  responsableVacio: boolean,
  cabeceraIncompleta: boolean,
  problemaInstrumentosFicha: string | null,
  tecnicosSinCargo: boolean,
): string {
  const faltantes: string[] = []
  if (!tablaBloqueada) faltantes.push('bloquear la tabla de reperfilado')
  if (responsableVacio) faltantes.push('completar el Responsable de Mantenimiento')
  if (cabeceraIncompleta) faltantes.push('completar el P.T. y la fecha/hora de inicio')
  if (problemaInstrumentosFicha) faltantes.push(problemaInstrumentosFicha)
  if (tecnicosSinCargo) faltantes.push('completar el Cargo de los técnicos con nombre o firma registrados')
  return `Falta ${juntarConY(faltantes)} para poder confirmar la ficha.`
}

// Un técnico de la tabla de firmas (Cargo|Nombre|Firma) con nombre y/o firma
// ya cargados pero sin Cargo — igual que bloquePersonaIncompleto (FooterFicha.tsx)
// pero acotado a este único campo, a pedido explícito del usuario: el Cargo
// pasa a ser obligatorio para poder confirmar/descargar, no solo informativo.
function tecnicoSinCargo(tecnico: { cargo: string | null; nombre: string | null; firma: string | null }): boolean {
  const cargo = tecnico.cargo?.trim() ?? ''
  const nombre = tecnico.nombre?.trim() ?? ''
  const firma = tecnico.firma?.startsWith('data:image/') ? tecnico.firma : ''
  return cargo === '' && (nombre !== '' || firma !== '')
}

function mensajeEstadoVerificacion(
  tablaBloqueada: boolean,
  verificado: boolean,
  resultadoVerificacion: ResumenVerificacion | null,
): string {
  if (tablaBloqueada) return '🔒 Tabla de reperfilado bloqueada.'
  if (resultadoVerificacion && !resultadoVerificacion.todoValido) {
    const n = resultadoVerificacion.filasExcluidas.length
    return n > 0
      ? `⚠ Ficha con ${n} fila(s) con problemas — corregí antes de continuar.`
      : '⚠ Corregí los datos de cabecera antes de continuar.'
  }
  if (verificado) return '✅ Ficha verificada — lista para bloquear.'
  return 'Verifica los límites antes de bloquear la tabla de reperfilado.'
}

function esErrorNoEncontrado(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status === 'number' &&
    (error as { response: { status: number } }).response.status === 404
  )
}

export function Reperfilado({
  onCambiarMotivo,
}: {
  onCambiarMotivo?: (motivo: MotivoFicha) => void
}) {
  const { fichaId } = useParams<{ fichaId?: string }>()
  const navigate = useNavigate()
  const [cancelando, setCancelando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [medicionAnteriorAbierta, setMedicionAnteriorAbierta] = useState(false)
  // Última respuesta de /validate — alimenta el modal de resultado Y
  // resaltarInvalidos de la tabla. NO se limpia al cerrar el modal (ver
  // modalAbierto, mismo patrón que NuevasMedicionesMedicion): solo la
  // reemplaza una nueva verificación, así la columna Motivo/Inválido de la
  // tabla no desaparece apenas el usuario cierra el diálogo para ir a corregir.
  const [resultado, setResultado] = useState<ResumenVerificacion | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [nombrePdfPersonalizado, setNombrePdf] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const verificarCardRef = useRef<HTMLDivElement>(null)
  const [verificarFlotante, setVerificarFlotante] = useState(false)
  const [verificarRect, setVerificarRect] = useState({ left: 0, width: 0 })
  const preview = useFichaPreview(fichaId ?? '', { page: 1, pageSize: 100 })
  const editar = useEditarFicha(fichaId ?? '')
  const verificar = useVerificarFicha(fichaId ?? '')
  const bloquear = useBloquearFicha(fichaId ?? '')
  const confirmar = useConfirmarFicha(fichaId ?? '')
  const cancelar = useCancelarFicha(fichaId ?? '')
  const ficha = preview.data?.ficha
  const nombrePdf = nombrePdfPersonalizado ?? (ficha ? `UT-UF-MTO-FR-414 - Tren ${ficha.trenNumero}` : '')
  const rows = preview.data?.rows ?? []
  const tablaBloqueada = ficha?.tablaBloqueada ?? false
  const responsableVacio = !ficha?.responsableMantenimientoNombre?.trim()
  const cabeceraIncompleta =
    !ficha?.puestoTrabajo?.trim() ||
    !ficha?.fechaHoraInicio
  const problemaInstrumentosFicha = ficha ? problemaInstrumentos(ficha.instrumentos, ficha.fechaFicha) : null
  const tecnicosSinCargo = (ficha?.tecnicos ?? []).slice(0, 3).some(tecnicoSinCargo)
  const puedeConfirmar = tablaBloqueada && !responsableVacio && !cabeceraIncompleta && !problemaInstrumentosFicha && !tecnicosSinCargo
  // Descargar PDF solo tiene sentido con la tabla ya bloqueada (Verificar) y
  // el Supervisor/Coordinador/Técnico Especialista (última fila de la tabla
  // de firmas) completo — antes de eso el PDF saldría con datos a medio llenar.
  // El Cargo de los técnicos (filas 1-3) cuenta igual: con nombre o firma
  // pero sin cargo, el PDF saldría con esa fila a medio llenar también.
  const puedeDescargarPdf = tablaBloqueada && !responsableVacio && !tecnicosSinCargo
  const motivosValidacion = resultado
    ? [
        resultado.kmInvalido?.motivo,
        resultado.fechaInvalido?.motivo,
        resultado.filasExcluidas.length > 0
          ? `${resultado.filasExcluidas.length} disco(s) tienen mediciones fuera de los límites.`
          : null,
        ...resultado.alertasReperfilado,
      ].filter((motivo): motivo is string => Boolean(motivo))
    : []

  useEffect(() => {
    if (fichaId) {
      guardarFichaActiva('reperfilado', fichaId)
      return
    }
    const activa = obtenerFichaActiva('reperfilado')
    if (activa) navigate(`/nuevas-mediciones/${activa}`, { replace: true })
  }, [fichaId, navigate])

  useEffect(() => {
    if (!fichaId || !preview.isError || !esErrorNoEncontrado(preview.error)) return
    limpiarFichaActiva('reperfilado')
    navigate('/nuevas-mediciones', { replace: true })
  }, [fichaId, navigate, preview.error, preview.isError])

  useEffect(() => {
    const card = verificarCardRef.current
    const scroller = card?.closest('main')
    if (!card || !scroller) return
    const cardEl = card
    const scrollerEl = scroller

    function actualizarBarraFlotante() {
      const cardRect = cardEl.getBoundingClientRect()
      const scrollerRect = scrollerEl.getBoundingClientRect()
      const margenSuperior = scrollerRect.top + 12
      setVerificarFlotante(cardRect.bottom < margenSuperior)
      setVerificarRect({
        left: cardRect.left,
        width: cardRect.width,
      })
    }

    actualizarBarraFlotante()
    scrollerEl.addEventListener('scroll', actualizarBarraFlotante, {
      passive: true,
    })
    window.addEventListener('resize', actualizarBarraFlotante)
    return () => {
      scrollerEl.removeEventListener('scroll', actualizarBarraFlotante)
      window.removeEventListener('resize', actualizarBarraFlotante)
    }
  }, [fichaId, preview.data, resultado, tablaBloqueada])

  useEffect(() => {
    if (fichaId) window.dispatchEvent(new Event(EVENTO_COLAPSAR_SIDEBAR))
  }, [fichaId])

  function irAlPrimerError() {
    setModalAbierto(false)
    window.requestAnimationFrame(() => {
      const campo = document.querySelector<HTMLElement>('[data-reperfilado-invalido="true"]')
      const destino = campo ?? document.querySelector<HTMLElement>('table')
      destino?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      campo?.focus()
    })
  }

  function cardVerificacion(flotante = false) {
    return (
      <GlassSurface
        fuerte
        className={`flex flex-wrap items-center justify-between gap-3 rounded-glass p-4 ${
          flotante ? 'shadow-[0_18px_45px_rgba(15,23,42,0.16)]' : ''
        }`}
      >
        <p className="font-body text-sm text-concreto-oscuro">
          {mensajeEstadoVerificacion(tablaBloqueada, ficha?.verificado ?? false, resultado)}
        </p>
        {errorAccion && (
          <p role="alert" className="w-full text-sm text-[color:var(--color-estado-critico)]">
            ⚠ {errorAccion}
          </p>
        )}
        {resultado?.todoValido && (
          <div
            role="status"
            aria-live="polite"
            className="w-full rounded-2xl border border-emerald-700/20 bg-emerald-50/70 px-4 py-3 font-body text-sm font-semibold text-emerald-800"
          >
            ✓ Validación correcta: los valores nuevos presentan la reducción esperada y la rugosidad final R.A. cumple el estándar de 2,5 µm.
          </div>
        )}
        {!tablaBloqueada && (
          <GlassButton
            type="button"
            variante="secundario"
            cargando={verificar.isPending || bloquear.isPending}
            onClick={async () => {
              setErrorAccion(null)
              try {
                const validacion = await verificar.mutateAsync()
                if (!validacion.todoValido) {
                  setResultado(validacion)
                  setModalAbierto(true)
                  return
                }
                await bloquear.mutateAsync()
                setResultado(validacion)
              } catch (error) {
                setErrorAccion(extraerMensajeError(error, 'No se pudo validar y bloquear la ficha.'))
              }
            }}
            className="text-xs"
          >
            Verificar
          </GlassButton>
        )}
      </GlassSurface>
    )
  }

  return (
    <div className={fichaId ? 'px-2 py-4 sm:px-3' : 'px-3 py-6 sm:px-5'}>
      <div className={fichaId ? 'w-full' : 'mx-auto flex max-w-[75rem] flex-col gap-4 xl:max-w-[96rem] xl:flex-row xl:items-start'}>
        <div className={fichaId ? 'min-w-0' : 'min-w-0 flex-1'}>
          <GlassSurface className="flex flex-wrap items-center justify-between gap-4 rounded-glass px-6 py-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
                Reperfilado
              </h1>
              <p className="mt-0.5 font-body text-sm text-concreto">
                Control de trabajos en torno fosa - discos de freno Tren Alstom
              </p>
            </div>
          </GlassSurface>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Motivo
          </p>
          <SegmentedControl
            ariaLabel="Motivo de la ficha"
            opciones={MOTIVO_OPCIONES.map((opcion) =>
              fichaId && opcion.valor !== 'Reperfilado'
                ? {
                    ...opcion,
                    deshabilitada: true,
                    tooltip: 'Cancela o confirma la ficha actual para cambiar de motivo.',
                    tooltipPosicion: 'abajo' as const,
                  }
                : opcion,
            )}
            valor="Reperfilado"
            onCambiar={(valor) => {
              if (valor === 'Medición') {
                const activa = obtenerFichaActiva('medicion')
                onCambiarMotivo?.('Medición')
                navigate(
                  activa
                    ? `/nuevas-mediciones/${activa}`
                    : '/nuevas-mediciones',
                )
              }
            }}
          />
        </div>

        {!fichaId && (
          <GlassSurface fuerte className="mt-4 rounded-glass-lg p-6 sm:p-8">
            <CargaInicialReperfilado
              onCreada={(id) => {
                guardarFichaActiva('reperfilado', id)
                navigate(`/nuevas-mediciones/${id}`)
              }}
            />
          </GlassSurface>
        )}

        {fichaId &&
          (preview.isLoading ? (
            <p className="mt-6 text-sm text-concreto">Cargando ficha…</p>
          ) : preview.isError ? (
            <p
              role="alert"
              className="mt-6 text-sm text-[color:var(--color-estado-critico)]"
            >
              {extraerMensajeError(preview.error)}
            </p>
          ) : ficha && preview.data ? (
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
                  disabled={cancelar.isPending}
                  className="text-xs"
                  style={{
                    borderColor: 'var(--color-estado-critico)',
                    color: 'var(--color-estado-critico)',
                  }}
                >
                  Cancelar ficha
                </GlassButton>
              </div>
              <div ref={verificarCardRef} className="mt-3">
                {cardVerificacion()}
              </div>
              {verificarFlotante && (
                <div
                  className="pointer-events-auto fixed top-[4.75rem] z-50"
                  style={{
                    left: verificarRect.left,
                    width: verificarRect.width,
                  }}
                >
                  {cardVerificacion(true)}
                </div>
              )}
              <ConteoEstadosFicha rows={rows} ocultarReperfilado />
              <GlassSurface fuerte className="mt-3 rounded-glass-lg p-5 sm:p-6">
                <HeaderReperfilado
                  ficha={ficha}
                  onGuardar={(c) => editar.mutate(c)}
                  deshabilitada={tablaBloqueada}
                />
              </GlassSurface>
              <div
                role="alert"
                className="mt-4 flex gap-3 rounded-glass border border-amber-600/30 bg-amber-50/80 px-5 py-4"
              >
                <TriangleAlert
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-700"
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-800">
                    Normas de seguridad
                  </p>
                  <p className="mt-1 text-sm font-medium text-amber-900">
                    Antes de poner en marcha el torno se deben informar los
                    trabajos a las áreas involucradas y cumplir los controles de
                    seguridad exigidos por la empresa.
                  </p>
                </div>
              </div>
              <TablaFichaReperfilado
                fichaId={fichaId}
                esqueleto={preview.data.esqueleto}
                rows={rows}
                codigosBogie={ficha.codigosBogie}
                deshabilitada={tablaBloqueada}
                resaltarInvalidos={resultado !== null}
                filasExcluidasVerificacion={resultado?.filasExcluidas}
              />
              <GlassSurface
                fuerte
                className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4"
              >
                <p className="text-sm font-semibold text-concreto-oscuro">
                  ¿Todas las medidas conformes?
                </p>
                <SegmentedControl
                  ariaLabel="Todas las medidas conformes"
                  opciones={[
                    { valor: 'si', etiqueta: 'Sí' },
                    { valor: 'no', etiqueta: 'No' },
                  ]}
                  valor={
                    valorConformidad(ficha.todasConformes)
                  }
                  onCambiar={(v) =>
                    editar.mutate({ todasConformes: v === 'si' })
                  }
                />
              </GlassSurface>
              {tablaBloqueada && (
                <FooterFicha
                  ficha={ficha}
                  onGuardar={(c) => editar.mutate(c)}
                  limiteTecnicos={3}
                  variante="reperfilado"
                />
              )}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <label className="min-w-64 font-body text-xs text-concreto">
                  Nombre del PDF
                  <input
                    className="glass-field mt-1 block w-full px-3 py-2 text-sm text-concreto-oscuro"
                    value={nombrePdf}
                    onChange={(event) => setNombrePdf(event.target.value)}
                    placeholder="Nombre de la ficha"
                    aria-label="Nombre del archivo PDF"
                  />
                </label>
                {puedeDescargarPdf ? (
                  <GlassButton
                    type="button"
                    variante="secundario"
                    cargando={descargandoPdf}
                    className="text-xs"
                    onClick={async () => {
                      setDescargandoPdf(true)
                      try {
                        await descargarPdfReperfilado(fichaId, nombrePdf)
                      } finally {
                        setDescargandoPdf(false)
                      }
                    }}
                  >
                    <Download size={16} aria-hidden />
                    Descargar PDF
                  </GlassButton>
                ) : (
                  <WarningTooltip
                    texto={
                      tecnicosSinCargo
                        ? 'Completa el Cargo de los técnicos con nombre o firma registrados para poder descargar el PDF.'
                        : 'Bloquea la tabla con Verificar y completa el Supervisor / Coordinador / Técnico Especialista para poder descargar el PDF.'
                    }
                  >
                    <GlassButton
                      type="button"
                      variante="secundario"
                      aria-disabled="true"
                      className="cursor-not-allowed text-xs opacity-60"
                    >
                      <Download size={16} aria-hidden />
                      Descargar PDF
                    </GlassButton>
                  </WarningTooltip>
                )}
                {puedeConfirmar ? (
                  <GlassButton
                    cargando={confirmar.isPending}
                    onClick={() => setConfirmando(true)}
                  >
                    Confirmar ficha
                  </GlassButton>
                ) : (
                  <WarningTooltip texto={mensajeConfirmarBloqueado(tablaBloqueada, responsableVacio, cabeceraIncompleta, problemaInstrumentosFicha, tecnicosSinCargo)}>
                    <GlassButton
                      aria-disabled="true"
                      className="cursor-not-allowed opacity-60"
                    >
                      Confirmar ficha
                    </GlassButton>
                  </WarningTooltip>
                )}
              </div>
            </>
          ) : null)}
          {!fichaId && (
            <div className="mt-4 xl:hidden">
              <PanelHistorialMediciones motivo="Reperfilado" />
            </div>
          )}
        </div>

        {!fichaId && (
          <aside className="hidden xl:block xl:w-80 xl:shrink-0">
            <div className="sticky top-6">
              <PanelHistorialMediciones motivo="Reperfilado" />
            </div>
          </aside>
        )}
      </div>

      {medicionAnteriorAbierta && fichaId && ficha && (
        <ModalMedicionAnterior
          fichaId={fichaId}
          trenNumero={ficha.trenNumero}
          onCerrar={() => setMedicionAnteriorAbierta(false)}
        />
      )}
      {cancelando && (
        <ConfirmDialog
          titulo="Cancelar ficha de reperfilado"
          variante="danger"
          textoConfirmar="Sí, cancelar"
          onConfirm={async () => {
            await cancelar.mutateAsync()
            limpiarFichaActiva('reperfilado')
            navigate('/nuevas-mediciones', { replace: true })
          }}
          onCerrar={() => setCancelando(false)}
          mensaje="Se eliminará esta ficha en borrador."
        />
      )}
      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar reperfilado"
          textoConfirmar="Sí, confirmar"
          onConfirm={async () => {
            await confirmar.mutateAsync()
            limpiarFichaActiva('reperfilado')
            navigate('/mediciones', { replace: true })
          }}
          onCerrar={() => setConfirmando(false)}
          mensaje="Los valores posteriores al torno se guardarán como una nueva intervención confirmada."
        />
      )}
      {modalAbierto && resultado && !resultado.todoValido && (
        <ConfirmDialog
          titulo="No se puede bloquear todavía"
          mensaje="Corrige la información indicada y vuelve a validar. La tabla seguirá editable."
          textoConfirmar="Seguir editando"
          textoCancelar="Cerrar"
          onConfirm={irAlPrimerError}
          onCerrar={() => setModalAbierto(false)}
        >
          <ul className="mt-3 space-y-1.5 rounded-2xl border border-amber-600/15 bg-amber-50/45 px-4 py-3 font-body text-sm text-concreto-oscuro">
            {motivosValidacion.map((motivo) => (
              <li key={motivo} className="flex gap-2">
                <span aria-hidden="true" className="text-amber-700">•</span>
                <span>{motivo}</span>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
    </div>
  )
}
