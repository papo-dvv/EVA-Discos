import type { EstadoDisco } from '../scan-records/types'

// Espejo de apps/api/src/inventory/inventory-query.ts (InventoryRow) y del
// enum InventoryStage/FaseDisco de apps/api/prisma/schema.prisma.
export const INVENTORY_STAGES = ['almacen', 'taller', 'en_servicio'] as const
export type InventoryStage = (typeof INVENTORY_STAGES)[number]

export const FASES_DISCO = ['nueva', 'usada'] as const
export type FaseDisco = (typeof FASES_DISCO)[number]

export const ETIQUETA_STAGE: Record<InventoryStage, string> = {
  almacen: 'Almacén',
  taller: 'Taller',
  en_servicio: 'En servicio',
}

export interface InventoryRow {
  id: string
  serie: string | null
  stage: InventoryStage
  fase: FaseDisco
  marcaRueda: string | null
  fabricante: string | null
  tValue: number | null
  hValue: number | null
  rdValue: number | null
  estadoCalculado: EstadoDisco | null
  asociacion: string
  ultimoMovimiento: {
    tipo: 'retiro_masivo' | 'cambio_disco'
    fecha: string
    encargadoNombre: string
  } | null
}

export interface InventoryResult {
  rows: InventoryRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface InventoryStats {
  almacen: number
  taller: number
  en_servicio: number
}

export interface InventoryQuery {
  page: number
  pageSize: number
  stage?: InventoryStage[]
  fase?: FaseDisco[]
  search?: string
}

export interface RegistrarDiscoInput {
  serie: string
  marcaRueda?: string
  proveedorId?: string
}
