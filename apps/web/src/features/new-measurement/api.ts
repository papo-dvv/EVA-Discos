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
  ResultadoDuplicadoDetectado,
  ResultadoReferencia,
  ResumenBloqueo,
  ResumenCargaMedicion,
  ResumenCommitMedicion,
  ResumenFichaManual,
  ResumenReset,
  ResumenVerificacion,
  TipoReferencia,
} from './types'

// Ficha de medición individual — espejo de features/migration/api.ts, contra
// /new-measurement en vez de /migration/:fileId.

export async function subirCsvMedicion(
  file: File,
  motivo?: MotivoFicha,
): Promise<ResumenCargaMedicion | ResultadoDuplicadoDetectado> {
  const form = new FormData()
  form.append('file', file)
  if (motivo) form.append('motivo', motivo)
  const { data } = await apiClient.post<
    ResumenCargaMedicion | ResultadoDuplicadoDetectado
  >('/new-measurement/upload', form)
  return data
}

export async function crearFichaManual(dto: {
  trenNumero: number
  kilometraje: number
  fecha?: string
  motivo?: MotivoFicha
}): Promise<ResumenFichaManual> {
  const { data } = await apiClient.post<ResumenFichaManual>(
    '/new-measurement/manual',
    dto,
  )
  return data
}

export interface ResultadoOcrReperfilado {
  trenNumero: number | null
  kilometraje: number | null
  puestoTrabajo: string | null
  fecha: string | null
  horaInicio: string | null
  horaFin: string | null
  confianza: number
  filas: Array<{
    ejeNumero: number
    lado: 'izquierdo' | 'derecho'
    tAntes: number
    hAntes: number
    tValue: number
    hValue: number
    rugosidadRa: number
    confianza: number
  }>
  advertencias: string[]
  textoReconocido: string
}

export async function leerFotoReperfilado(
  file: File,
): Promise<ResultadoOcrReperfilado> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<ResultadoOcrReperfilado>(
    '/new-measurement/reprofiling/photo',
    form,
  )
  return data
}

export async function descargarPdfReperfilado(
  fichaId: string,
  nombreArchivo?: string,
): Promise<void> {
  const { data } = await apiClient.get<Blob>(
    `/new-measurement/${fichaId}/reprofiling/pdf`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(data)
  const enlace = document.createElement('a')
  enlace.href = url
  const nombreSeguro = (nombreArchivo ?? `reperfilado-${fichaId}`)
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
  enlace.download = `${nombreSeguro || `reperfilado-${fichaId}`}.pdf`
  enlace.click()
  URL.revokeObjectURL(url)
}

export async function obtenerFicha(fichaId: string): Promise<FichaMedicion> {
  const { data } = await apiClient.get<FichaMedicion>(
    `/new-measurement/${fichaId}`,
  )
  return data
}

export async function obtenerPreviewFicha(
  fichaId: string,
  params: PreviewParams,
): Promise<PreviewFichaResult> {
  const { data } = await apiClient.get<PreviewFichaResult>(
    `/new-measurement/${fichaId}/preview`,
    {
      params,
    },
  )
  return data
}

export async function editarFicha(
  fichaId: string,
  cambios: CambiosFicha,
): Promise<FichaMedicion> {
  const { data } = await apiClient.patch<FichaMedicion>(
    `/new-measurement/${fichaId}`,
    cambios,
  )
  return data
}

export async function agregarFilaFicha(
  fichaId: string,
  dto: AgregarFilaFicha,
): Promise<PreviewRow> {
  const { data } = await apiClient.post<PreviewRow>(
    `/new-measurement/${fichaId}/records`,
    dto,
  )
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

export async function verificarFicha(
  fichaId: string,
): Promise<ResumenVerificacion> {
  const { data } = await apiClient.post<ResumenVerificacion>(
    `/new-measurement/${fichaId}/validate`,
  )
  return data
}

export async function bloquearFicha(fichaId: string): Promise<ResumenBloqueo> {
  const { data } = await apiClient.post<ResumenBloqueo>(
    `/new-measurement/${fichaId}/lock`,
  )
  return data
}

export async function obtenerReferenciaFicha(
  trenNumero: number,
  tipo: TipoReferencia,
): Promise<ResultadoReferencia> {
  const { data } = await apiClient.get<ResultadoReferencia>(
    '/new-measurement/reference',
    {
      params: { tren: trenNumero, tipo },
    },
  )
  return data
}

export async function confirmarFicha(
  fichaId: string,
): Promise<ResumenCommitMedicion> {
  const { data } = await apiClient.post<ResumenCommitMedicion>(
    `/new-measurement/${fichaId}/commit`,
  )
  return data
}

export async function cancelarFicha(
  fichaId: string,
): Promise<{ fichaId: string; cancelado: boolean }> {
  const { data } = await apiClient.delete<{
    fichaId: string
    cancelado: boolean
  }>(`/new-measurement/${fichaId}`)
  return data
}

export async function reiniciarFicha(fichaId: string): Promise<ResumenReset> {
  const { data } = await apiClient.post<ResumenReset>(
    `/new-measurement/${fichaId}/reset`,
  )
  return data
}
