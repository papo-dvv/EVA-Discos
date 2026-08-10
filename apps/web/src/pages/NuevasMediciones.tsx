import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { PantallaFondo } from '../components/PantallaFondo'
import { SegmentedControl } from '../components/SegmentedControl'
import { WarningTooltip } from '../components/WarningTooltip'
import { CargaInicialFicha } from '../features/new-measurement/components/CargaInicialFicha'
import { FooterFicha } from '../features/new-measurement/components/FooterFicha'
import { HeaderFicha } from '../features/new-measurement/components/HeaderFicha'
import { TablaFichaEspejo } from '../features/new-measurement/components/TablaFichaEspejo'
import { useCancelarFicha, useConfirmarFicha, useEditarFicha, useFichaPreview } from '../features/new-measurement/queries'
import type { MotivoFicha } from '../features/new-measurement/types'
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

// Ficha de medición individual (punto 1-4 del enunciado). Una sola pantalla:
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

  const preview = useFichaPreview(fichaId ?? '', { page: 1, pageSize: 100 })
  const editarFicha = useEditarFicha(fichaId ?? '')
  const confirmarFicha = useConfirmarFicha(fichaId ?? '')
  const cancelarFicha = useCancelarFicha(fichaId ?? '')

  async function confirmar() {
    await confirmarFicha.mutateAsync()
    navigate('/mediciones', { replace: true })
  }

  async function cancelar() {
    await cancelarFicha.mutateAsync()
    navigate('/nuevas-mediciones', { replace: true })
  }

  const ficha = preview.data?.ficha
  const responsableVacio = !ficha?.responsableMantenimientoNombre?.trim()

  return (
    <PantallaFondo className="px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-[75rem]">
        <GlassSurface className="rounded-glass px-6 py-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
            Nuevas mediciones
          </h1>
          <p className="mt-0.5 font-body text-sm text-concreto">Registro de una ficha de medición individual</p>
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
            <CargaInicialFicha onCreada={(id) => navigate(`/nuevas-mediciones/${id}`)} />
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
            ) : preview.data ? (
              <>
                <div className="mt-4 flex justify-end">
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

                <GlassSurface fuerte className="mt-3 rounded-glass-lg p-5 sm:p-6">
                  <HeaderFicha ficha={preview.data.ficha} onGuardar={(c) => editarFicha.mutate(c)} />
                </GlassSurface>

                <TablaFichaEspejo
                  fichaId={fichaId}
                  esqueleto={preview.data.esqueleto}
                  rows={preview.data.rows}
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
                    valor={valorConformidad(preview.data.ficha.todasConformes)}
                    onCambiar={(v) => editarFicha.mutate({ todasConformes: v === 'si' })}
                  />
                </GlassSurface>

                <FooterFicha ficha={preview.data.ficha} onGuardar={(c) => editarFicha.mutate(c)} />

                <div className="mt-5 flex justify-end gap-2">
                  {responsableVacio ? (
                    // aria-disabled (no `disabled`): igual criterio que
                    // SegmentedControl — un botón nativo disabled no deja que
                    // el WarningTooltip que lo envuelve reciba hover/foco.
                    <WarningTooltip texto="Completa el nombre del Responsable de Mantenimiento para poder confirmar la ficha.">
                      <GlassButton type="button" aria-disabled="true" className="cursor-not-allowed opacity-60">
                        Confirmar ficha
                      </GlassButton>
                    </WarningTooltip>
                  ) : (
                    <GlassButton type="button" onClick={() => setConfirmando(true)} cargando={confirmarFicha.isPending}>
                      Confirmar ficha
                    </GlassButton>
                  )}
                </div>
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
    </PantallaFondo>
  )
}
