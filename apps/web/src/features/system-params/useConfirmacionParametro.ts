import { useState } from 'react'
import type { AjusteConsenso, SystemParamItem } from './api'
import { useActualizarSystemParam } from './queries'

export type SolicitudConfirmacion = { clave: string; anterior: string; nuevo: string }
export type AvisoAjusteState = { clave: string; ajustes: AjusteConsenso[] }

// Cuando el intento de guardar ESTA clave falló (422 u otro rechazo), el
// input de FilaParametro debe volver a mostrar el valor vigente en vez de
// dejar el valor rechazado escrito — se logra remontando el componente (la
// key cambia) igual que ya ocurre al guardar con éxito (ahí cambia porque
// param.valor cambia). `actualizar` es una única mutación compartida por
// todas las filas de un panel, así que solo se usa isError/variables de la
// ÚLTIMA combinación clave+valor intentada — no hay condición de carrera
// posible porque el ConfirmDialog que dispara la mutación es modal (un
// intento a la vez).
export function claveFilaConEstado(
  p: SystemParamItem,
  actualizar: ReturnType<typeof useActualizarSystemParam>,
): string {
  const falloEstaClave = actualizar.isError && actualizar.variables?.clave === p.clave
  return `${p.clave}:${p.valor}:${falloEstaClave ? 'error' : 'ok'}`
}

// Estado + flujo compartido por todo panel que edita parámetros del sistema
// inline (input + Guardar + ConfirmDialog): PanelParametros (Migración/
// Mediciones/Tasa de desgaste) y PanelMetodosTrazabilidad (percentiles +
// amplitud_maxima_extremo). `onExito` corre SOLO tras un PATCH exitoso,
// además del aviso de ajuste — lo usa Trazabilidad para invalidar sus
// propias queries (el consenso cambia con cualquiera de estos parámetros,
// a diferencia de los umbrales de Rd que no la afectan).
export function useConfirmacionParametro(onExito?: () => void) {
  const actualizar = useActualizarSystemParam()
  const [confirmando, setConfirmando] = useState<SolicitudConfirmacion | null>(null)
  const [avisoAjuste, setAvisoAjuste] = useState<AvisoAjusteState | null>(null)

  async function confirmar() {
    if (!confirmando) return
    const resultado = await actualizar.mutateAsync({
      clave: confirmando.clave,
      valor: confirmando.nuevo,
    })
    setAvisoAjuste(
      resultado.ajustesConsenso.length > 0
        ? { clave: confirmando.clave, ajustes: resultado.ajustesConsenso }
        : null,
    )
    onExito?.()
  }

  return { actualizar, confirmando, setConfirmando, avisoAjuste, setAvisoAjuste, confirmar }
}
