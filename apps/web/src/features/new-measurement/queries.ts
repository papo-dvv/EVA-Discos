import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agregarFilaFicha,
  cancelarFicha,
  confirmarFicha,
  editarFicha,
  editarFilaFicha,
  eliminarFilaFicha,
  obtenerPreviewFicha,
} from './api'
import type {
  AgregarFilaFicha,
  CambiosFicha,
  EditarFilaFicha,
  PreviewParams,
} from './types'

// Hooks de una ficha de medición individual — espejo de features/migration/queries.ts
// (que además importa los de lectura compartidos de features/scan-records/queries;
// acá no aplica: la ficha tiene su propia forma de respuesta — ficha + esqueleto +
// filas — así que no comparte los hooks "mode-aware" de esa familia).

const claveRaiz = (fichaId: string) => ['new-measurement', fichaId] as const
const clavePreview = (fichaId: string, params: PreviewParams) =>
  ['new-measurement', fichaId, 'preview', params] as const

export function useFichaPreview(fichaId: string, params: PreviewParams) {
  return useQuery({
    queryKey: clavePreview(fichaId, params),
    queryFn: () => obtenerPreviewFicha(fichaId, params),
    enabled: fichaId !== '',
  })
}

function useInvalidarFicha(fichaId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claveRaiz(fichaId) })
}

export function useEditarFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: (cambios: CambiosFicha) => editarFicha(fichaId, cambios),
    onSuccess: invalidar,
  })
}

export function useAgregarFilaFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: (dto: AgregarFilaFicha) => agregarFilaFicha(fichaId, dto),
    onSuccess: invalidar,
  })
}

export function useEditarFilaFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: ({ recordId, cambios }: { recordId: string; cambios: EditarFilaFicha }) =>
      editarFilaFicha(fichaId, recordId, cambios),
    onSuccess: invalidar,
  })
}

export function useEliminarFilaFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: (recordId: string) => eliminarFilaFicha(fichaId, recordId),
    onSuccess: invalidar,
  })
}

export function useConfirmarFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: () => confirmarFicha(fichaId),
    onSuccess: invalidar,
  })
}

// No invalida: la ficha deja de existir y el componente navega fuera al
// confirmar éxito — mismo criterio que useCancelarMigracion.
export function useCancelarFicha(fichaId: string) {
  return useMutation({
    mutationFn: () => cancelarFicha(fichaId),
  })
}
