import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agregarFilaFicha,
  bloquearFicha,
  cancelarFicha,
  confirmarFicha,
  editarFicha,
  editarFilaFicha,
  eliminarFilaFicha,
  obtenerPreviewFicha,
  obtenerReferenciaFicha,
  verificarFicha,
} from './api'
import type {
  AgregarFilaFicha,
  CambiosFicha,
  EditarFilaFicha,
  PreviewParams,
  TipoReferencia,
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

// POST .../validate — re-evalúa los flags de todas las filas y fija
// measurement_sheet.verificado; invalida para que la tabla refleje de
// inmediato qué filas quedaron excluida_del_commit.
export function useVerificarFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: () => verificarFicha(fichaId),
    onSuccess: invalidar,
  })
}

// POST .../lock — exige verificado=true (ver backend); invalida para que
// header/tabla pasen a solo-lectura y el footer se habilite.
export function useBloquearFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  return useMutation({
    mutationFn: () => bloquearFicha(fichaId),
    onSuccess: invalidar,
  })
}

// GET /new-measurement/reference?tren=&tipo= — comparativa histórica (punto
// 6) y también la fuente de "valor previo" para las alertas de la tabla en
// curso (punto 1): ambos usos comparten esta misma query/caché de React
// Query, así que abrir el modal de "Medición Anterior" con tipo=ultima_medicion
// no dispara un segundo fetch si la página ya la pidió para las alertas.
export function useReferenciaFicha(trenNumero: number | undefined, tipo: TipoReferencia) {
  return useQuery({
    queryKey: ['new-measurement', 'reference', trenNumero, tipo] as const,
    queryFn: () => obtenerReferenciaFicha(trenNumero!, tipo),
    enabled: trenNumero !== undefined,
  })
}

// No invalida: la ficha deja de existir y el componente navega fuera al
// confirmar éxito — mismo criterio que useCancelarMigracion.
export function useCancelarFicha(fichaId: string) {
  return useMutation({
    mutationFn: () => cancelarFicha(fichaId),
  })
}
