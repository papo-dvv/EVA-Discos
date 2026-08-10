import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { GlassButton } from '../../../components/GlassButton'
import { GlassSurface } from '../../../components/GlassSurface'
import { TarjetaAlertaFuerte } from '../../../components/TarjetaAlertaFuerte'
import type { SystemParamItem } from '../../system-params/api'
import { useSystemParams } from '../../system-params/queries'
import { claveFilaConEstado, useConfirmacionParametro } from '../../system-params/useConfirmacionParametro'
import { useMeasurementGapSummary } from '../queries'
import type { CategoriaMeasurementGap } from '../types'
import { ModalDetalleBrecha } from './ModalDetalleBrecha'

const CLAVE = 'measurement_gap_umbral_meses'
// Rango pedido para este control puntual (1 a 6 meses) — el backend en sí
// solo exige min:0 (ver PARAMS_EDITABLES), así que este acotamiento 1-6 es
// una regla de UX de esta card, no una validación que venga del servidor.
const UMBRAL_MIN = 1
const UMBRAL_MAX = 6

type CategoriaDetalle = Exclude<CategoriaMeasurementGap, 'normal'>

// Card de "hace cuánto no se mide" cada disco (measurement-gap): el umbral
// normal/alerta es configurable acá mismo (mismo patrón de FilaParametro +
// ConfirmDialog que PanelParametros), pero el corte severo queda SIEMPRE fijo
// en el backend (7 meses) — en esta UI nunca se muestra ese "7": el texto
// siempre dice "mayor a 6 meses" para no mezclar el límite configurable con
// el límite fijo.
export function TarjetaBrechaFechas() {
  const queryClient = useQueryClient()
  const params = useSystemParams()
  const summary = useMeasurementGapSummary()
  const { actualizar, confirmando, setConfirmando, confirmar } = useConfirmacionParametro(() =>
    queryClient.invalidateQueries({ queryKey: ['measurement-gap'] }),
  )
  const [categoriaDetalle, setCategoriaDetalle] = useState<CategoriaDetalle | null>(null)

  const paramUmbral = params.data?.find((p) => p.clave === CLAVE)

  if (params.isLoading || summary.isLoading) {
    return (
      <GlassSurface fuerte className="rounded-glass p-4">
        <p className="font-body text-sm text-concreto">Cargando…</p>
      </GlassSurface>
    )
  }
  if (!summary.data) return null

  const { conteos, discos, umbralMesesUsado } = summary.data
  const alertas = discos.filter((d) => d.categoria === 'alerta')
  const severos = discos.filter((d) => d.categoria === 'alertaSevera')

  return (
    <>
      <GlassSurface fuerte className="rounded-glass p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-concreto-oscuro">
              Brecha de fechas
            </h3>
            <p className="mt-0.5 font-body text-xs text-concreto">
              Discos sin medir hace más de <span className="font-data">{umbralMesesUsado}</span>{' '}
              mes(es) (alerta) o más de 6 meses (severa).
            </p>
          </div>
          {paramUmbral && (
            <InputUmbralBrecha
              key={claveFilaConEstado(paramUmbral, actualizar)}
              param={paramUmbral}
              onGuardar={(nuevo) =>
                setConfirmando({ clave: CLAVE, anterior: paramUmbral.valor, nuevo })
              }
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <MiniConteo etiqueta="Normal" valor={conteos.normal} />
          <MiniConteo etiqueta="Alerta" valor={conteos.alerta} />
          <MiniConteo etiqueta="Mayor a 6 meses" valor={conteos.alertaSevera} />
        </div>
      </GlassSurface>

      {conteos.alerta > 0 && (
        <TarjetaAlertaFuerte
          tono="cambio"
          className="mt-3"
          glifo="⏱"
          titulo="Alerta — se acerca la brecha"
          descripcion={
            <>
              <span className="font-data">{conteos.alerta}</span> disco(s) entre{' '}
              <span className="font-data">{umbralMesesUsado}</span> y 6 meses sin medir.
            </>
          }
          acciones={
            <button
              type="button"
              onClick={() => setCategoriaDetalle('alerta')}
              className="rounded-full border border-white/50 bg-white/15 px-4 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              Ver detalle
            </button>
          }
        />
      )}

      {conteos.alertaSevera > 0 && (
        <TarjetaAlertaFuerte
          tono="critico"
          className="mt-3"
          glifo="⛔"
          titulo="Mayor a 6 meses sin medir"
          descripcion={
            <>
              <span className="font-data">{conteos.alertaSevera}</span> disco(s) recomendados para
              medir con urgencia.
            </>
          }
          acciones={
            <button
              type="button"
              onClick={() => setCategoriaDetalle('alertaSevera')}
              className="rounded-full border border-white/50 bg-white/15 px-4 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              Ver detalle
            </button>
          }
        />
      )}

      {categoriaDetalle && (
        <ModalDetalleBrecha
          titulo={categoriaDetalle === 'alerta' ? 'Alerta' : 'Mayor a 6 meses sin medir'}
          discos={categoriaDetalle === 'alerta' ? alertas : severos}
          onCerrar={() => setCategoriaDetalle(null)}
        />
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar cambio de umbral"
          textoConfirmar="Sí, cambiar"
          onConfirm={confirmar}
          onCerrar={() => setConfirmando(null)}
          mensaje={
            <>
              ¿Cambiar el umbral de brecha de fechas de <b className="font-data">{confirmando.anterior}</b>{' '}
              a <b className="font-data">{confirmando.nuevo}</b> mes(es)? Esto afecta la clasificación de
              TODOS los discos.
            </>
          }
        />
      )}
    </>
  )
}

function MiniConteo({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-2xl bg-white/45 px-3 py-2 text-center">
      <div className="font-data text-lg font-semibold text-concreto-oscuro">{valor}</div>
      <div className="font-body text-[10px] uppercase tracking-[0.08em] text-concreto">{etiqueta}</div>
    </div>
  )
}

// Mismo patrón que FilaParametro (input + Guardar habilitado solo si cambió),
// acotado al rango 1-6 pedido para este control puntual. Remontado por key
// (claveFilaConEstado) igual que cualquier fila de PanelParametros: así el
// input vuelve a mostrar el valor vigente si el PATCH previo falló.
function InputUmbralBrecha({
  param,
  onGuardar,
}: {
  param: SystemParamItem
  onGuardar: (nuevo: string) => void
}) {
  const [valor, setValor] = useState(param.valor)
  const limpio = valor.trim()
  const numerico = Number(limpio)
  const esValido = limpio !== '' && Number.isFinite(numerico) && numerico >= UMBRAL_MIN && numerico <= UMBRAL_MAX
  const cambiado = esValido && limpio !== param.valor

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-end gap-2">
        <div className="w-20">
          <label className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-concreto">
            Umbral (meses)
          </label>
          <input
            type="number"
            min={UMBRAL_MIN}
            max={UMBRAL_MAX}
            step={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Umbral de brecha de fechas en meses"
            className="glass-field px-2.5 py-1.5 text-right font-data text-sm"
          />
        </div>
        <GlassButton
          variante="secundario"
          disabled={!cambiado}
          onClick={() => onGuardar(limpio)}
          className="px-3 py-1.5 text-xs"
        >
          Guardar
        </GlassButton>
      </div>
      {!esValido && limpio !== '' && (
        <p className="font-body text-[11px] text-[color:var(--color-estado-critico)]">
          Debe estar entre {UMBRAL_MIN} y {UMBRAL_MAX}.
        </p>
      )}
    </div>
  )
}
