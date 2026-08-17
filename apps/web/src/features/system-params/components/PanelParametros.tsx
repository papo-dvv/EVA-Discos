import { GlassSurface } from '../../../components/GlassSurface'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ScrollArea } from '../../../components/ScrollArea'
import type { SystemParamItem } from '../api'
import { useSystemParams } from '../queries'
import { claveFilaConEstado, useConfirmacionParametro } from '../useConfirmacionParametro'
import { AvisoAjusteConsenso } from './AvisoAjusteConsenso'
import { FilaParametro } from './FilaParametro'

// Los 3 umbrales de Rd (OK/Seguimiento/Cambio) se agrupan visualmente juntos,
// en este orden fijo, sin importar el orden alfabético en que responde el
// backend (rd_umbral_critico queda fuera: el motor de reglas no lo usa — el
// límite de Crítico es fijo en rd ≤ 0 — así que no forma parte de este grupo).
const ORDEN_GRUPO_RD = ['rd_umbral_ok', 'rd_umbral_seguimiento', 'rd_umbral_cambio']

// Los 4 percentiles del consenso de trazabilidad + su epsilon de piso +
// amplitud_maxima_extremo, en este orden fijo — mismo criterio que
// ORDEN_GRUPO_RD. Cambiar cualquiera de los 4 primeros dispara la validación
// de consenso en el backend (Reglas A/B, ver ConsensoValidationService);
// consenso_extremo_epsilon y amplitud_maxima_extremo nunca la disparan, pero
// se agrupan junto porque solo tienen sentido en este contexto (ver el mismo
// grupo, con los mismos controles, en PanelMetodosTrazabilidad).
const ORDEN_GRUPO_CONSENSO = [
  'percentil_limite_inferior',
  'percentil_limite_superior',
  'percentil_extremo_inferior',
  'percentil_extremo_superior',
  'consenso_extremo_epsilon',
  'amplitud_maxima_extremo',
]

// Único parámetro editable donde un valor vacío es válido ("sin
// restricción") — ver el mismo criterio en ConsensoConfigService.obtenerAmplitudMaximaExtremo.
const CLAVES_PERMITEN_VACIO = new Set(['amplitud_maxima_extremo'])
// Estos tres parámetros se editan exclusivamente desde Proyección, donde se
// ven junto a la fórmula y al pronóstico que afectan.
const CLAVES_EXCLUSIVAS_PROYECCION = new Set([
  'h_umbral_reperfilado',
  'rd_umbral_seguimiento',
  'reperfilado_descuento_rd',
])

// Parámetros del sistema editables inline, con confirmación previa al PATCH.
// Genérico y reutilizable: lista TODO parámetro con editable=true que
// devuelva GET /system-params (ej. umbrales de Rd en /mediciones, km_mensual
// en /tasa-desgaste) — no conoce de antemano cuáles existen, así que un
// parámetro nuevo aparece automáticamente en cuanto el backend lo habilita
// (ver PARAMS_EDITABLES en apps/api), sin tocar este componente.
export function PanelParametros() {
  const params = useSystemParams()
  const { actualizar, confirmando, setConfirmando, avisoAjuste, setAvisoAjuste, confirmar } =
    useConfirmacionParametro()

  // Solo los numéricos editables (outlier_metodo es enum, no input numérico).
  // measurement_gap_umbral_meses tampoco entra acá: tiene su propio control
  // dedicado (rango 1-6) dentro de la card de brecha de fechas — ver
  // TarjetaBrechaFechas, mismo criterio de exclusión que outlier_metodo.
  const editables = (params.data ?? []).filter(
    (p) =>
      p.editable &&
      p.clave !== 'outlier_metodo' &&
      p.clave !== 'measurement_gap_umbral_meses' &&
      !CLAVES_EXCLUSIVAS_PROYECCION.has(p.clave),
  )
  // Umbrales de Rd agrupados y en orden fijo (ok, seguimiento, cambio — este
  // último aparece automáticamente en cuanto el backend lo devuelva); el resto
  // de parámetros editables va debajo, en el orden en que responde la API.
  const grupoRd = ORDEN_GRUPO_RD.map((clave) => editables.find((p) => p.clave === clave)).filter(
    (p): p is SystemParamItem => p !== undefined,
  )
  const grupoConsenso = ORDEN_GRUPO_CONSENSO.map((clave) =>
    editables.find((p) => p.clave === clave),
  ).filter((p): p is SystemParamItem => p !== undefined)
  const clavesAgrupadas = new Set([...grupoRd, ...grupoConsenso].map((p) => p.clave))
  const resto = editables.filter((p) => !clavesAgrupadas.has(p.clave))

  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <h3 className="mb-1 font-display text-base font-semibold text-concreto-oscuro">
        Parámetros
      </h3>
      <p className="mb-3 font-body text-xs text-concreto">
        Umbrales de clasificación. Cambiarlos afecta a todos los discos.
      </p>

      {avisoAjuste && (
        <AvisoAjusteConsenso
          clave={avisoAjuste.clave}
          ajustes={avisoAjuste.ajustes}
          onCerrar={() => setAvisoAjuste(null)}
        />
      )}

      {params.isLoading ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : (
        // Scroll propio (styles.md §6): el panel se corta con muchos
        // parámetros sin esto — el contenido puede crecer más que el alto
        // visible de la columna lateral.
        <ScrollArea viewportClassName="max-h-[21rem]" className="-mr-1 pr-1">
          <div className="space-y-4">
            {grupoRd.length > 0 && (
              <div className="space-y-2.5">
                <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">
                  Umbrales de Rd
                </p>
                {grupoRd.map((p) => (
                  <FilaParametro
                    key={claveFilaConEstado(p, actualizar)}
                    param={p}
                    onGuardar={(nuevo) =>
                      setConfirmando({ clave: p.clave, anterior: p.valor, nuevo })
                    }
                  />
                ))}
              </div>
            )}
            {grupoConsenso.length > 0 && (
              <div className="space-y-2.5">
                <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">
                  Percentiles de consenso
                </p>
                {grupoConsenso.map((p) => (
                  <FilaParametro
                    key={claveFilaConEstado(p, actualizar)}
                    param={p}
                    permitirVacio={CLAVES_PERMITEN_VACIO.has(p.clave)}
                    onGuardar={(nuevo) =>
                      setConfirmando({ clave: p.clave, anterior: p.valor, nuevo })
                    }
                  />
                ))}
              </div>
            )}
            {resto.length > 0 && (
              <div className="space-y-2.5">
                {(grupoRd.length > 0 || grupoConsenso.length > 0) && (
                  <p className="font-body text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-concreto">
                    Otros parámetros
                  </p>
                )}
                {resto.map((p) => (
                  <FilaParametro
                    key={claveFilaConEstado(p, actualizar)}
                    param={p}
                    onGuardar={(nuevo) =>
                      setConfirmando({ clave: p.clave, anterior: p.valor, nuevo })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Confirmar cambio de parámetro"
          textoConfirmar="Sí, cambiar"
          onConfirm={confirmar}
          onCerrar={() => setConfirmando(null)}
          mensaje={
            <>
              ¿Seguro que quieres cambiar{' '}
              <span className="font-data">{confirmando.clave}</span> de{' '}
              <b className="font-data">{confirmando.anterior}</b> a{' '}
              <b className="font-data">{confirmando.nuevo}</b>? Esto afecta cómo se clasifican{' '}
              <b>TODOS</b> los discos.
            </>
          }
        />
      )}
    </GlassSurface>
  )
}
