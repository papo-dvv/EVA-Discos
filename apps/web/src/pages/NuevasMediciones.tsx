import { useMemo, useState } from 'react'
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
import { ModalMedicionAnterior } from '../features/new-measurement/components/ModalMedicionAnterior'
import { TablaFichaEspejo } from '../features/new-measurement/components/TablaFichaEspejo'
import {
  useBloquearFicha,
  useCancelarFicha,
  useConfirmarFicha,
  useEditarFicha,
  useFichaPreview,
  useReferenciaFicha,
  useVerificarFicha,
} from '../features/new-measurement/queries'
import { construirMapaReferenciaPorEjeLado } from '../features/new-measurement/referenciaAnterior'
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

// Mensaje del tooltip de "Confirmar ficha" según cuál(es) de las 2
// condiciones obligatorias (punto 4 del enunciado) todavía falten.
function mensajeConfirmarBloqueado(tablaBloqueada: boolean, responsableVacio: boolean): string {
  if (!tablaBloqueada && responsableVacio) {
    return 'Bloquea la tabla de mediciones (Verificar → Bloquear Mediciones) y completa el Responsable de Mantenimiento para poder confirmar la ficha.'
  }
  if (!tablaBloqueada) {
    return 'Bloquea la tabla de mediciones (Verificar → Bloquear Mediciones) para poder confirmar la ficha.'
  }
  return 'Completa el nombre del Responsable de Mantenimiento para poder confirmar la ficha.'
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
  // Última response de /validate a mostrar en el modal de resultado — null
  // mientras no se llamó a Verificar todavía (o el modal ya se cerró).
  const [resultadoVerificacion, setResultadoVerificacion] = useState<ResumenVerificacion | null>(null)

  const preview = useFichaPreview(fichaId ?? '', { page: 1, pageSize: 100 })
  const editarFicha = useEditarFicha(fichaId ?? '')
  const confirmarFicha = useConfirmarFicha(fichaId ?? '')
  const cancelarFicha = useCancelarFicha(fichaId ?? '')
  const verificarFicha = useVerificarFicha(fichaId ?? '')
  const bloquearFicha = useBloquearFicha(fichaId ?? '')

  const ficha = preview.data?.ficha
  const rows = preview.data?.rows ?? []

  // Última medición confirmada de CADA disco de este tren (mismo GET
  // .../reference que alimenta el modal de "Medición Anterior") — acá se usa
  // como fuente del "valor previo" en las alertas de fila (punto 1) y del
  // banner de Km/Fecha del header. Una sola query, cacheada por React Query:
  // si el usuario después abre "Medición Anterior" → "Última Medición", no
  // dispara un segundo fetch.
  const referencia = useReferenciaFicha(ficha?.trenNumero, 'ultima_medicion')
  // Narrowing manual con 'fecha' in ...: useReferenciaFicha es genérico en
  // TipoReferencia (el hook no liga el tipo de retorno al valor literal
  // pasado), así que TS no sabe por sí solo que ACÁ, con tipo='ultima_medicion'
  // fijo, el resultado nunca puede ser ReferenciaUltimaFicha.
  const referenciaDisponible =
    referencia.data?.disponible && 'fecha' in referencia.data ? referencia.data : undefined
  const referenciaPorEjeLado = useMemo(
    () => (referenciaDisponible ? construirMapaReferenciaPorEjeLado(referenciaDisponible.rows) : undefined),
    [referenciaDisponible],
  )
  const kmInvalido = rows.some((r) => r.kmInvalido)
  const fechaInvalido = rows.some((r) => r.fechaInvalido)

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
      onSuccess: (resumen) => setResultadoVerificacion(resumen),
    })
  }

  const responsableVacio = !ficha?.responsableMantenimientoNombre?.trim()
  const tablaBloqueada = ficha?.tablaBloqueada ?? false
  const puedeConfirmar = tablaBloqueada && !responsableVacio

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

                <GlassSurface fuerte className="mt-3 rounded-glass-lg p-5 sm:p-6">
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
                  referenciaPorEjeLado={referenciaPorEjeLado}
                />

                <GlassSurface fuerte className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-glass p-4">
                  <p className="font-body text-sm text-concreto-oscuro">
                    {tablaBloqueada
                      ? '🔒 Tabla de mediciones bloqueada.'
                      : ficha.verificado
                        ? '✅ Ficha verificada — lista para bloquear.'
                        : 'Verifica la ficha antes de poder bloquear la tabla de mediciones.'}
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

                <FooterFicha ficha={ficha} onGuardar={(c) => editarFicha.mutate(c)} bloqueada={tablaBloqueada} />

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <WarningTooltip texto="Disponible próximamente">
                    <GlassButton type="button" aria-disabled="true" className="cursor-not-allowed opacity-60">
                      Descargar PDF
                    </GlassButton>
                  </WarningTooltip>

                  {puedeConfirmar ? (
                    <GlassButton type="button" onClick={() => setConfirmando(true)} cargando={confirmarFicha.isPending}>
                      Confirmar ficha
                    </GlassButton>
                  ) : (
                    // aria-disabled (no `disabled`): igual criterio que
                    // SegmentedControl — un botón nativo disabled no deja que
                    // el WarningTooltip que lo envuelve reciba hover/foco.
                    <WarningTooltip texto={mensajeConfirmarBloqueado(tablaBloqueada, responsableVacio)}>
                      <GlassButton type="button" aria-disabled="true" className="cursor-not-allowed opacity-60">
                        Confirmar ficha
                      </GlassButton>
                    </WarningTooltip>
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

      {resultadoVerificacion && (
        <ConfirmDialog
          titulo={resultadoVerificacion.todoValido ? 'Todos los datos están OK' : 'Quedan filas excluidas del commit'}
          mensaje={
            resultadoVerificacion.todoValido
              ? '¿Bloquear la tabla de mediciones? La tabla y el header (Fecha/Tren/Kilometraje) pasan a solo lectura y se habilita el footer.'
              : `${resultadoVerificacion.filasExcluidas.length} fila(s) siguen con algún problema y quedaron excluidas del commit final. Podés bloquear igual (se confirmarán solo las filas válidas) o seguir editando para corregirlas.`
          }
          textoConfirmar="Bloquear Mediciones"
          textoCancelar={resultadoVerificacion.todoValido ? 'Cancelar' : 'Seguir editando'}
          onConfirm={async () => {
            await bloquearFicha.mutateAsync()
          }}
          onCerrar={() => setResultadoVerificacion(null)}
        >
          {!resultadoVerificacion.todoValido && (
            <ul className="mt-3 space-y-1 font-body text-xs text-concreto-oscuro">
              {resultadoVerificacion.filasExcluidas.map((f) => (
                <li key={f.id}>
                  Eje {f.ejeExcel ?? '—'} · {f.ubicacionExcel ?? '—'} — {f.motivos.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </ConfirmDialog>
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
