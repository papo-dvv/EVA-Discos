import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as migracionApi from '../migration/api'
import {
  editarFilaConfirmada,
  eliminarFilaConfirmada,
  obtenerOpcionesFiltroConfirmado,
  obtenerPreviewConfirmado,
  obtenerResumenPorTrenConfirmado,
  obtenerSemaforoMediciones,
  obtenerStatsConfirmado,
  obtenerValoresDistintosConfirmado,
} from './api'
import type { AlcanceScanRecords, CambiosFila, CampoValoresDistintos, PreviewParams } from './types'

// Familia de hooks "mode-aware": deciden internamente si pegan a
// /migration/:fileId/... (modo borrador, alcance.fileId presente) o a
// /scan-records... (modo confirmado, sin fileId) — mismo shape de respuesta
// en ambos casos, así el resto de componentes (sidebar, tabla, filtros,
// stats) no necesitan saber en qué modo están.

const claves = {
  resumen: (a: AlcanceScanRecords) =>
    a.fileId ? (['migration', a.fileId, 'summary'] as const) : (['scan-records', 'summary'] as const),
  preview: (a: AlcanceScanRecords, params: PreviewParams) =>
    a.fileId
      ? (['migration', a.fileId, 'preview', params] as const)
      : (['scan-records', 'preview', params] as const),
  stats: (a: AlcanceScanRecords, params: PreviewParams) =>
    a.fileId
      ? (['migration', a.fileId, 'stats', params] as const)
      : (['scan-records', 'stats', params] as const),
  filtros: (a: AlcanceScanRecords) =>
    a.fileId ? (['migration', a.fileId, 'filtros'] as const) : (['scan-records', 'filtros'] as const),
  valoresDistintos: (a: AlcanceScanRecords, campo: CampoValoresDistintos) =>
    a.fileId
      ? (['migration', a.fileId, 'valores-distintos', campo] as const)
      : (['scan-records', 'valores-distintos', campo] as const),
  raiz: (a: AlcanceScanRecords) => (a.fileId ? (['migration', a.fileId] as const) : (['scan-records'] as const)),
}

export function useScanRecordsResumenPorTren(alcance: AlcanceScanRecords) {
  return useQuery({
    queryKey: claves.resumen(alcance),
    queryFn: () =>
      alcance.fileId
        ? migracionApi.obtenerResumenPorTren(alcance.fileId)
        : obtenerResumenPorTrenConfirmado(),
  })
}

// Semáforo "días sin medir" por tren (vista de tarjetas de Mediciones) —
// siempre confirmados, no tiene equivalente en modo migración (fileId).
export function useSemaforoMediciones() {
  return useQuery({
    queryKey: ['scan-records', 'semaforo-mediciones'] as const,
    queryFn: obtenerSemaforoMediciones,
    staleTime: 60 * 1000,
  })
}

export function useScanRecordsPreview(alcance: AlcanceScanRecords, params: PreviewParams) {
  return useQuery({
    queryKey: claves.preview(alcance, params),
    queryFn: () =>
      alcance.fileId
        ? migracionApi.obtenerPreview(alcance.fileId, params)
        : obtenerPreviewConfirmado(params),
  })
}

// Conteo por estado (total vs. filtrado) para el panel de estados. Comparte
// los mismos params que la búsqueda paginada para que "filtrado" refleje lo
// visible en ese momento.
export function useScanRecordsStats(alcance: AlcanceScanRecords, params: PreviewParams) {
  return useQuery({
    queryKey: claves.stats(alcance, params),
    queryFn: () =>
      alcance.fileId ? migracionApi.obtenerStats(alcance.fileId, params) : obtenerStatsConfirmado(params),
  })
}

// Opciones de los multi-selects (coche/bogie) — estables durante la sesión.
export function useScanRecordsOpcionesFiltro(alcance: AlcanceScanRecords) {
  return useQuery({
    queryKey: claves.filtros(alcance),
    queryFn: () =>
      alcance.fileId
        ? migracionApi.obtenerOpcionesFiltro(alcance.fileId)
        : obtenerOpcionesFiltroConfirmado(),
    staleTime: 5 * 60 * 1000,
  })
}

// Valores distintos para poblar los dropdowns de Motivo/Responsable (ver
// PanelFiltros) — estables durante la sesión, igual criterio que
// useScanRecordsOpcionesFiltro.
export function useScanRecordsValoresDistintos(
  alcance: AlcanceScanRecords,
  campo: CampoValoresDistintos,
) {
  return useQuery({
    queryKey: claves.valoresDistintos(alcance, campo),
    queryFn: () =>
      alcance.fileId
        ? migracionApi.obtenerValoresDistintos(alcance.fileId, campo)
        : obtenerValoresDistintosConfirmado(campo),
    staleTime: 5 * 60 * 1000,
  })
}

function useInvalidarScanRecords(alcance: AlcanceScanRecords) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claves.raiz(alcance) })
}

export function useEditarScanRecordFila(alcance: AlcanceScanRecords) {
  const invalidar = useInvalidarScanRecords(alcance)
  return useMutation({
    mutationFn: ({ rowId, cambios }: { rowId: string; cambios: CambiosFila }) =>
      alcance.fileId
        ? migracionApi.editarFila(alcance.fileId, rowId, cambios)
        : editarFilaConfirmada(rowId, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarScanRecordFila(alcance: AlcanceScanRecords) {
  const invalidar = useInvalidarScanRecords(alcance)
  return useMutation({
    mutationFn: (rowId: string) =>
      alcance.fileId ? migracionApi.eliminarFila(alcance.fileId, rowId) : eliminarFilaConfirmada(rowId),
    onSuccess: invalidar,
  })
}
