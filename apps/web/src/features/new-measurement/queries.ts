import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agregarFilaFicha,
  actualizarRelacionBogie,
  bloquearFicha,
  cancelarFicha,
  confirmarFicha,
  crearRelacionBogie,
  editarFicha,
  editarFilaFicha,
  eliminarRelacionBogie,
  eliminarFilaFicha,
  obtenerHistorialMediciones,
  obtenerCatalogoBogies,
  obtenerPreviewFicha,
  obtenerReferenciaFicha,
  obtenerSubidasRecientesCount,
  reiniciarFicha,
  verificarFicha,
} from './api'
import type {
  AgregarFilaFicha,
  CambiosFicha,
  EditarFilaFicha,
  MotivoFicha,
  PreviewParams,
  TipoReferencia,
} from './types'
import type { RelacionBogieInput as RelacionBogieInputApi } from './api'

// Hooks de una ficha de medición individual — espejo de features/migration/queries.ts
// (que además importa los de lectura compartidos de features/scan-records/queries;
// acá no aplica: la ficha tiene su propia forma de respuesta — ficha + esqueleto +
// filas — así que no comparte los hooks "mode-aware" de esa familia).

const claveRaiz = (fichaId: string) => ['new-measurement', fichaId] as const
const clavePreview = (fichaId: string, params: PreviewParams) =>
  ['new-measurement', fichaId, 'preview', params] as const
const claveHistorial = ['new-measurement', 'historial'] as const
const claveCatalogoBogies = ['new-measurement', 'bogie-catalog'] as const

// Feed global (todos los trenes) de la card de historial — ver
// PanelHistorialMediciones. Se invalida desde las mutaciones que generan un
// evento (reiniciar/cancelar/bloquear/confirmar acá, subir CSV/crear manual
// en CargaInicialFicha.tsx) en vez de depender de polling.
export function useHistorialMediciones(limit?: number, motivo?: MotivoFicha) {
  return useQuery({
    queryKey: [...claveHistorial, limit, motivo] as const,
    queryFn: () => obtenerHistorialMediciones(limit, motivo),
  })
}

export function useInvalidarHistorialMediciones() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: claveHistorial })
}

export function useSubidasRecientesCount(dias = 30) {
  return useQuery({
    queryKey: ['new-measurement', 'subidas-recientes-count', dias] as const,
    queryFn: () => obtenerSubidasRecientesCount(dias),
    staleTime: 60 * 1000,
  })
}

export function useCatalogoBogies() {
  return useQuery({
    queryKey: claveCatalogoBogies,
    queryFn: obtenerCatalogoBogies,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCrearRelacionBogie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: RelacionBogieInputApi) => crearRelacionBogie(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claveCatalogoBogies }),
  })
}

export function useActualizarRelacionBogie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RelacionBogieInputApi }) => actualizarRelacionBogie(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claveCatalogoBogies }),
  })
}

export function useEliminarRelacionBogie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => eliminarRelacionBogie(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claveCatalogoBogies }),
  })
}

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
  const invalidarHistorial = useInvalidarHistorialMediciones()
  return useMutation({
    mutationFn: () => confirmarFicha(fichaId),
    onSuccess: () => {
      invalidar()
      invalidarHistorial()
    },
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
  const invalidarHistorial = useInvalidarHistorialMediciones()
  return useMutation({
    mutationFn: () => bloquearFicha(fichaId),
    onSuccess: () => {
      invalidar()
      invalidarHistorial()
    },
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

// No invalida la ficha en sí: deja de existir y el componente navega fuera al
// confirmar éxito — mismo criterio que useCancelarMigracion. Sí invalida el
// historial (el evento ficha_cancelada sobrevive al borrado de la ficha).
export function useCancelarFicha(fichaId: string) {
  const invalidarHistorial = useInvalidarHistorialMediciones()
  return useMutation({
    mutationFn: () => cancelarFicha(fichaId),
    onSuccess: invalidarHistorial,
  })
}

// POST .../reset ("Resubir CSV" / "Reiniciar ficha") — vacía la tabla de
// mediciones actual reutilizando el mismo fichaId (nunca crea una ficha
// nueva). Invalida para que preview/ficha reflejen el estado recién
// reiniciado: 0 filas, verificado=false, tablaBloqueada=false.
export function useReiniciarFicha(fichaId: string) {
  const invalidar = useInvalidarFicha(fichaId)
  const invalidarHistorial = useInvalidarHistorialMediciones()
  return useMutation({
    mutationFn: () => reiniciarFicha(fichaId),
    onSuccess: () => {
      invalidar()
      invalidarHistorial()
    },
  })
}
