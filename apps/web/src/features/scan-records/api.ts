import { apiClient } from '../../lib/apiClient'
import type {
  CambiosFila,
  CampoValoresDistintos,
  OpcionesFiltro,
  PreviewParams,
  PreviewResult,
  PreviewRow,
  ResumenTren,
  SemaforoTrenMediciones,
  StatsScanRecords,
} from './types'

// Vista permanente de mediciones YA confirmadas — sin fileId, disponible en
// cualquier momento (no solo justo tras una migración). Espejo de
// features/migration/api.ts, apuntando a /scan-records en vez de
// /migration/:fileId.

export async function obtenerResumenPorTrenConfirmado(): Promise<ResumenTren[]> {
  const { data } = await apiClient.get<ResumenTren[]>('/scan-records/summary-by-tren')
  return data
}

export async function obtenerSemaforoMediciones(): Promise<SemaforoTrenMediciones[]> {
  const { data } = await apiClient.get<SemaforoTrenMediciones[]>('/scan-records/semaforo-mediciones')
  return data
}

export async function obtenerPreviewConfirmado(params: PreviewParams): Promise<PreviewResult> {
  const { data } = await apiClient.get<PreviewResult>('/scan-records', { params })
  return data
}

export async function obtenerStatsConfirmado(params: PreviewParams): Promise<StatsScanRecords> {
  const { data } = await apiClient.get<StatsScanRecords>('/scan-records/stats', { params })
  return data
}

export async function obtenerOpcionesFiltroConfirmado(): Promise<OpcionesFiltro> {
  const { data } = await apiClient.get<OpcionesFiltro>('/scan-records/filtros')
  return data
}

export async function obtenerValoresDistintosConfirmado(
  campo: CampoValoresDistintos,
): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/scan-records/valores-distintos', {
    params: { campo },
  })
  return data
}

// El backend de confirmados (PATCH /scan-records/:id) NO acepta trenNumero ni
// los campos de identidad del disco — cambiarlos desincronizaría disc_id, que
// ya quedó resuelto en el commit. Se envían solo los campos que sí acepta,
// aunque `cambios` traiga más (el modal de edición ya los oculta en este modo).
export async function editarFilaConfirmada(rowId: string, cambios: CambiosFila): Promise<PreviewRow> {
  const { responsableNombre, kilometraje, fecha, motivo, hValue, tValue } = cambios
  const { data } = await apiClient.patch<PreviewRow>(`/scan-records/${rowId}`, {
    responsableNombre,
    kilometraje,
    fecha,
    motivo,
    hValue,
    tValue,
  })
  return data
}

export async function eliminarFilaConfirmada(rowId: string): Promise<{ eliminadas: number }> {
  const { data } = await apiClient.delete<{ eliminadas: number }>(`/scan-records/${rowId}`)
  return data
}
