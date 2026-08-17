import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { PantallaFondo } from '../components/PantallaFondo'
import { SegmentedControl } from '../components/SegmentedControl'
import { WarningTooltip } from '../components/WarningTooltip'
import { FooterFicha } from '../features/new-measurement/components/FooterFicha'
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
  MotivoFicha,
  ResumenVerificacion,
} from '../features/new-measurement/types'
import { CargaInicialReperfilado } from '../features/reprofiling/CargaInicialReperfilado'
import { HeaderReperfilado } from '../features/reprofiling/HeaderReperfilado'
import { extraerMensajeError } from '../lib/extraerMensajeError'

export function Reperfilado() {
  const { fichaId } = useParams<{ fichaId?: string }>()
  const navigate = useNavigate()
  const [cancelando, setCancelando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<ResumenVerificacion | null>(null)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [nombrePdf, setNombrePdf] = useState('')
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const preview = useFichaPreview(fichaId ?? '', { page: 1, pageSize: 100 })
  const editar = useEditarFicha(fichaId ?? '')
  const verificar = useVerificarFicha(fichaId ?? '')
  const bloquear = useBloquearFicha(fichaId ?? '')
  const confirmar = useConfirmarFicha(fichaId ?? '')
  const cancelar = useCancelarFicha(fichaId ?? '')
  const ficha = preview.data?.ficha
  const rows = preview.data?.rows ?? []
  const tablaBloqueada = ficha?.tablaBloqueada ?? false
  const responsableVacio = !ficha?.responsableMantenimientoNombre?.trim()
  const cabeceraIncompleta =
    !ficha?.puestoTrabajo?.trim() ||
    !ficha?.fechaHoraInicio
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
    if (activa) navigate(`/reperfilado/${activa}`, { replace: true })
  }, [fichaId, navigate])

  useEffect(() => {
    if (ficha && !nombrePdf) {
      setNombrePdf(`UT-UF-MTO-FR-414 - Tren ${ficha.trenNumero}`)
    }
  }, [ficha, nombrePdf])

  function irAlPrimerError() {
    setResultado(null)
    window.requestAnimationFrame(() => {
      const campo = document.querySelector<HTMLElement>('[data-reperfilado-invalido="true"]')
      const destino = campo ?? document.querySelector<HTMLElement>('table')
      destino?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      campo?.focus()
    })
  }

  return (
    <PantallaFondo className="px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-[88rem]">
        <GlassSurface className="rounded-glass px-6 py-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
            Reperfilado
          </h1>
          <p className="mt-0.5 font-body text-sm text-concreto">
            Control de trabajos en torno fosa - discos de freno Tren Alstom
          </p>
        </GlassSurface>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Motivo
          </p>
          <SegmentedControl<MotivoFicha>
            ariaLabel="Motivo de la ficha"
            opciones={[
              { valor: 'Medición', etiqueta: 'Medición' },
              { valor: 'Reperfilado', etiqueta: 'Reperfilado' },
              { valor: 'Cambio', etiqueta: 'Cambio', deshabilitada: true },
            ]}
            valor="Reperfilado"
            onCambiar={(valor) => {
              if (valor === 'Medición') {
                const activa = obtenerFichaActiva('medicion')
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
                navigate(`/reperfilado/${id}`)
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
              <div className="mt-4 flex flex-wrap items-end justify-end gap-2">
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
                <GlassButton
                  variante="secundario"
                  cargando={descargandoPdf}
                  onClick={async () => {
                    setDescargandoPdf(true)
                    try {
                      await descargarPdfReperfilado(fichaId, nombrePdf)
                    } finally {
                      setDescargandoPdf(false)
                    }
                  }}
                >
                  Descargar PDF
                </GlassButton>
                <GlassButton
                  variante="secundario"
                  onClick={() => setCancelando(true)}
                  style={{ color: 'var(--color-estado-critico)' }}
                >
                  Cancelar ficha
                </GlassButton>
              </div>
              <GlassSurface fuerte className="mt-3 rounded-glass-lg p-5 sm:p-6">
                <HeaderReperfilado
                  ficha={ficha}
                  onGuardar={(c) => editar.mutate(c)}
                  deshabilitada={tablaBloqueada}
                />
              </GlassSurface>
              <GlassSurface className="mt-4 rounded-glass px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
                  Normas de seguridad
                </p>
                <p className="mt-1 text-sm text-concreto-oscuro">
                  Antes de poner en marcha el torno se deben informar los
                  trabajos a las áreas involucradas y cumplir los controles de
                  seguridad exigidos por la empresa.
                </p>
              </GlassSurface>
              <TablaFichaReperfilado
                fichaId={fichaId}
                esqueleto={preview.data.esqueleto}
                rows={rows}
                codigosCoche={ficha.codigosCoche}
                codigosBogie={ficha.codigosBogie}
                onGuardarCodigos={(cambios) => editar.mutate(cambios)}
                deshabilitada={tablaBloqueada}
              />
              <GlassSurface
                fuerte
                className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4"
              >
                <p className="text-sm text-concreto-oscuro">
                  {tablaBloqueada
                    ? '🔒 Tabla de perfilado bloqueada.'
                    : ficha.verificado
                      ? '✅ Ficha verificada — lista para bloquear.'
                      : 'Verifica los límites antes de bloquear la tabla.'}
                </p>
                {errorAccion && <p role="alert" className="w-full text-sm text-[color:var(--color-estado-critico)]">⚠ {errorAccion}</p>}
                {!tablaBloqueada && (
                  <GlassButton
                    cargando={verificar.isPending || bloquear.isPending}
                    onClick={async () => {
                      setErrorAccion(null)
                      try {
                        const validacion = await verificar.mutateAsync()
                        if (!validacion.todoValido) {
                          setResultado(validacion)
                          return
                        }
                        await bloquear.mutateAsync()
                        setResultado(null)
                      } catch (error) {
                        setErrorAccion(extraerMensajeError(error, 'No se pudo validar y bloquear la ficha.'))
                      }
                    }}
                  >
                    Validar la información y bloquear
                  </GlassButton>
                )}
              </GlassSurface>
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
                    ficha.todasConformes === null
                      ? undefined
                      : ficha.todasConformes
                        ? 'si'
                        : 'no'
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
                  limiteTecnicos={2}
                />
              )}
              <div className="mt-5 flex justify-end">
                {tablaBloqueada && !responsableVacio && !cabeceraIncompleta ? (
                  <GlassButton
                    cargando={confirmar.isPending}
                    onClick={() => setConfirmando(true)}
                  >
                    Confirmar ficha
                  </GlassButton>
                ) : (
                  <WarningTooltip texto="Completa P.T. y fecha/hora de inicio, bloquea la tabla y registra el Responsable de Mantenimiento.">
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
      </div>

      {cancelando && (
        <ConfirmDialog
          titulo="Cancelar ficha de reperfilado"
          variante="danger"
          textoConfirmar="Sí, cancelar"
          onConfirm={async () => {
            await cancelar.mutateAsync()
            limpiarFichaActiva('reperfilado')
            navigate('/reperfilado', { replace: true })
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
      {resultado && !resultado.todoValido && (
        <ConfirmDialog
          titulo="No se puede bloquear todavía"
          mensaje="Corrige la información indicada y vuelve a validar. La tabla seguirá editable."
          textoConfirmar="Seguir editando"
          textoCancelar="Cerrar"
          onConfirm={irAlPrimerError}
          onCerrar={() => setResultado(null)}
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
    </PantallaFondo>
  )
}
