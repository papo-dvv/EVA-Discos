import { useState } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import type { SystemParamItem } from '../api'

// Fila editable de un parámetro del sistema: input + botón Guardar,
// habilitado solo cuando el valor cambió. Reutilizada por PanelParametros
// (Migración/Mediciones/Tasa de desgaste) y PanelMetodosTrazabilidad
// (percentiles de consenso + amplitud_maxima_extremo) — mismo patrón de
// interacción en los 2 lugares donde EVA permite editar parámetros inline.
// claveFilaConEstado (el helper de key para el truco de remount-on-error)
// vive en useConfirmacionParametro.ts, no acá: este archivo solo exporta el
// componente (react-refresh/only-export-components).
type Props = {
  param: SystemParamItem
  onGuardar: (nuevo: string) => void
  // true SOLO para parámetros donde un valor vacío es válido con significado
  // propio ("sin restricción" — ej. amplitud_maxima_extremo). Por defecto un
  // valor vacío nunca habilita Guardar (los umbrales/percentiles no lo aceptan).
  permitirVacio?: boolean
}

export function FilaParametro({ param, onGuardar, permitirVacio = false }: Props) {
  const [valor, setValor] = useState(param.valor)
  const limpio = valor.trim()
  const cambiado = (permitirVacio || limpio !== '') && limpio !== param.valor

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-[13px] font-medium text-concreto-oscuro">
          {param.clave}
        </p>
        {param.descripcion && (
          <p className="truncate font-body text-[11px] text-concreto" title={param.descripcion}>
            {param.descripcion}
          </p>
        )}
      </div>
      {/* Ancho fijo: glass-field fuerza width:100%, así el label conserva su espacio */}
      <div className="w-24 flex-shrink-0">
        <input
          type="number"
          step="any"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={permitirVacio ? 'Sin restr.' : undefined}
          aria-label={param.clave}
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
  )
}
