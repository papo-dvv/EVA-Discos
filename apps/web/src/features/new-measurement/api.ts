import { apiClient } from '../../lib/apiClient'
import type {
  AgregarFilaFicha,
  CambiosFicha,
  EditarFilaFicha,
  FichaMedicion,
  MotivoFicha,
  PreviewFichaResult,
  PreviewParams,
  PreviewRow,
  ResultadoReferencia,
  ResumenBloqueo,
  ResumenCargaMedicion,
  ResumenCommitMedicion,
  ResumenFichaManual,
  ResumenVerificacion,
  TipoReferencia,
} from './types'

// Ficha de medición individual — espejo de features/migration/api.ts, contra
// /new-measurement en vez de /migration/:fileId.

export async function subirCsvMedicion(
  file: File,
  motivo?: MotivoFicha,
): Promise<ResumenCargaMedicion> {
  const form = new FormData()
  form.append('file', file)
  if (motivo) form.append('motivo', motivo)
  const { data } = await apiClient.post<ResumenCargaMedicion>('/new-measurement/upload', form)
  return data
}

export async function crearFichaManual(dto: {
  trenNumero: number
  kilometraje: number
  fecha?: string
  motivo?: MotivoFicha
}): Promise<ResumenFichaManual> {
  const { data } = await apiClient.post<ResumenFichaManual>('/new-measurement/manual', dto)
  return data
}

export async function obtenerFicha(fichaId: string): Promise<FichaMedicion> {
  const { data } = await apiClient.get<FichaMedicion>(`/new-measurement/${fichaId}`)
  return data
}

export async function obtenerPreviewFicha(
  fichaId: string,
  params: PreviewParams,
): Promise<PreviewFichaResult> {
  const { data } = await apiClient.get<PreviewFichaResult>(`/new-measurement/${fichaId}/preview`, {
    params,
  })
  return data
}

export async function editarFicha(fichaId: string, cambios: CambiosFicha): Promise<FichaMedicion> {
  const { data } = await apiClient.patch<FichaMedicion>(`/new-measurement/${fichaId}`, cambios)
  return data
}

export async function agregarFilaFicha(
  fichaId: string,
  dto: AgregarFilaFicha,
): Promise<PreviewRow> {
  const { data } = await apiClient.post<PreviewRow>(`/new-measurement/${fichaId}/records`, dto)
  return data
}

export async function editarFilaFicha(
  fichaId: string,
  recordId: string,
  dto: EditarFilaFicha,
): Promise<PreviewRow> {
  const { data } = await apiClient.patch<PreviewRow>(
    `/new-measurement/${fichaId}/records/${recordId}`,
    dto,
  )
  return data
}

export async function eliminarFilaFicha(
  fichaId: string,
  recordId: string,
): Promise<{ eliminadas: number }> {
  const { data } = await apiClient.delete<{ eliminadas: number }>(
    `/new-measurement/${fichaId}/records/${recordId}`,
  )
  return data
}

export async function verificarFicha(fichaId: string): Promise<ResumenVerificacion> {
  const { data } = await apiClient.post<ResumenVerificacion>(`/new-measurement/${fichaId}/validate`)
  return data
}

export async function bloquearFicha(fichaId: string): Promise<ResumenBloqueo> {
  const { data } = await apiClient.post<ResumenBloqueo>(`/new-measurement/${fichaId}/lock`)
  return data
}

export async function obtenerReferenciaFicha(
  trenNumero: number,
  tipo: TipoReferencia,
): Promise<ResultadoReferencia> {
  const { data } = await apiClient.get<ResultadoReferencia>('/new-measurement/reference', {
    params: { tren: trenNumero, tipo },
  })
  return data
}

export async function confirmarFicha(fichaId: string): Promise<ResumenCommitMedicion> {
  const { data } = await apiClient.post<ResumenCommitMedicion>(`/new-measurement/${fichaId}/commit`)
  return data
}

export async function cancelarFicha(
  fichaId: string,
): Promise<{ fichaId: string; cancelado: boolean }> {
  const { data } = await apiClient.delete<{ fichaId: string; cancelado: boolean }>(
    `/new-measurement/${fichaId}`,
  )
  return data
}
