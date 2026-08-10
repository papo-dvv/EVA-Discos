import { apiClient } from '../../lib/apiClient'
import type {
  CambiosFila,
  CampoValoresDistintos,
  OpcionesFiltro,
  PreviewParams,
  PreviewResult,
  PreviewRow,
  ResumenMigracion,
  ResumenTren,
  StatsMigracion,
} from './types'

export async function subirMigracion(file: File): Promise<ResumenMigracion> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<ResumenMigracion>('/migration/upload', form)
  return data
}

export async function obtenerResumenPorTren(fileId: string): Promise<ResumenTren[]> {
  const { data } = await apiClient.get<ResumenTren[]>(`/migration/${fileId}/summary-by-tren`)
  return data
}

export async function obtenerPreview(
  fileId: string,
  params: PreviewParams,
): Promise<PreviewResult> {
  const { data } = await apiClient.get<PreviewResult>(`/migration/${fileId}/preview`, {
    params,
  })
  return data
}

// Conteo por estado del total de la carga y del subconjunto filtrado. Recibe
// los mismos filtros que la vista previa.
export async function obtenerStats(
  fileId: string,
  params: PreviewParams,
): Promise<StatsMigracion> {
  const { data } = await apiClient.get<StatsMigracion>(`/migration/${fileId}/stats`, {
    params,
  })
  return data
}

export async function obtenerOpcionesFiltro(fileId: string): Promise<OpcionesFiltro> {
  const { data } = await apiClient.get<OpcionesFiltro>(`/migration/${fileId}/filtros`)
  return data
}

export async function obtenerValoresDistintos(
  fileId: string,
  campo: CampoValoresDistintos,
): Promise<string[]> {
  const { data } = await apiClient.get<string[]>(`/migration/${fileId}/valores-distintos`, {
    params: { campo },
  })
  return data
}

export async function editarFila(
  fileId: string,
  rowId: string,
  cambios: CambiosFila,
): Promise<PreviewRow> {
  const { data } = await apiClient.patch<PreviewRow>(
    `/migration/${fileId}/rows/${rowId}`,
    cambios,
  )
  return data
}

export async function eliminarFila(
  fileId: string,
  rowId: string,
): Promise<{ eliminadas: number }> {
  const { data } = await apiClient.delete<{ eliminadas: number }>(
    `/migration/${fileId}/rows/${rowId}`,
  )
  return data
}

export async function eliminarTren(
  fileId: string,
  numeroTren: number,
): Promise<{ eliminadas: number }> {
  const { data } = await apiClient.delete<{ eliminadas: number }>(
    `/migration/${fileId}/tren/${numeroTren}`,
  )
  return data
}

export async function confirmarMigracion(
  fileId: string,
): Promise<{ fileId: string; status: string; totalFilas: number }> {
  const { data } = await apiClient.post<{ fileId: string; status: string; totalFilas: number }>(
    `/migration/${fileId}/commit`,
  )
  return data
}

export async function cancelarMigracion(
  fileId: string,
): Promise<{ fileId: string; cancelado: boolean }> {
  const { data } = await apiClient.delete<{ fileId: string; cancelado: boolean }>(
    `/migration/${fileId}`,
  )
  return data
}
