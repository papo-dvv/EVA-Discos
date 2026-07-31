import { apiClient } from '../../lib/apiClient'

// Espejo del contrato de apps/api/src/system-params. El valor viaja como texto;
// el backend valida el tipo (numérico vs. enum) según la clave y audita el
// cambio en system_param_audit.
export interface SystemParam {
  clave: string
  valor: string
  descripcion: string | null
  actualizadoPor: string | null
  actualizadoEn: string
  // Presente en TODA respuesta de PATCH (array vacío si no aplicó ningún
  // ajuste) — espejo de AjusteExtremo en consenso-validation.service.ts.
  // Solo lo produce un cambio en uno de los 4 parámetros de percentil cuando
  // la Regla B ajustó el extremo inferior de alguna combinación de scope.
  ajustesConsenso: AjusteConsenso[]
}

export interface AjusteConsenso {
  scope: string
  valorOriginal: number
  epsilonAplicado: number
}

// Espejo de CombinacionViolacion — solo viaja en el body del 422 cuando la
// Regla A rechaza el cambio (ver extraerCombinacionesConsenso).
export interface CombinacionViolacion {
  scope: string
  amplitud: number
}

// Item de la lista (GET): marca si el parámetro es editable inline.
export interface SystemParamItem {
  clave: string
  valor: string
  descripcion: string | null
  actualizadoEn: string
  editable: boolean
}

export async function listarSystemParams(): Promise<SystemParamItem[]> {
  const { data } = await apiClient.get<SystemParamItem[]>('/system-params')
  return data
}

export async function actualizarSystemParam(
  clave: string,
  valor: string,
): Promise<SystemParam> {
  const { data } = await apiClient.patch<SystemParam>(
    `/system-params/${clave}`,
    { valor },
  )
  return data
}
