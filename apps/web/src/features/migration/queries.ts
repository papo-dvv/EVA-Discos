import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelarMigracion, confirmarMigracion, eliminarTren, obtenerHistorialMigracion } from './api'

// Hooks EXCLUSIVOS de la migración masiva: no tienen equivalente en la vista
// permanente de confirmados (eliminar TODO un tren en bloque, confirmar el
// commit, cancelar la carga completa). Los hooks compartidos con esa vista
// (preview, stats, resumen por tren, opciones de filtro, editar/eliminar una
// fila) viven en features/scan-records/queries — mode-aware según haya o no
// fileId.

// Invalida tanto el preview como el resumen del sidebar tras cualquier
// mutación (los conteos por tren pueden cambiar).
const claveHistorialMigracion = ['migration', 'historial'] as const

export function useHistorialMigracion(limit?: number) {
  return useQuery({
    queryKey: [...claveHistorialMigracion, limit] as const,
    queryFn: () => obtenerHistorialMigracion(limit),
  })
}

export function useInvalidarHistorialMigracion() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claveHistorialMigracion })
}

function useInvalidarMigracion(fileId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['migration', fileId] })
}

export function useEliminarTren(fileId: string) {
  const invalidar = useInvalidarMigracion(fileId)
  return useMutation({
    mutationFn: (numeroTren: number) => eliminarTren(fileId, numeroTren),
    onSuccess: invalidar,
  })
}

export function useConfirmarMigracion(fileId: string) {
  const invalidar = useInvalidarMigracion(fileId)
  const invalidarHistorial = useInvalidarHistorialMigracion()
  return useMutation({
    mutationFn: () => confirmarMigracion(fileId),
    onSuccess: () => {
      invalidar()
      invalidarHistorial()
    },
  })
}

// Cancela (borra) la carga completa. No invalida queries: la carga deja de
// existir y el componente navega fuera de la vista previa al confirmar éxito.
export function useCancelarMigracion(fileId: string) {
  const invalidarHistorial = useInvalidarHistorialMigracion()
  return useMutation({
    mutationFn: () => cancelarMigracion(fileId),
    onSuccess: invalidarHistorial,
  })
}
