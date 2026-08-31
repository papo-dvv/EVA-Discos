import type { EstadoDisco } from '../scan-records/types'

// Espejo de apps/api/src/inventory/inventory-query.ts (InventoryRow) y del
// enum InventoryStage/FaseDisco/ModeloTren de apps/api/prisma/schema.prisma.
// "Todos" ya no existe como stage — el toggle de Inventario solo tiene los 3
// reales, siempre uno seleccionado.
export const INVENTORY_STAGES = ['taller', 'en_servicio', 'almacen'] as const
export type InventoryStage = (typeof INVENTORY_STAGES)[number]

export const FASES_DISCO = ['nueva', 'usada'] as const
export type FaseDisco = (typeof FASES_DISCO)[number]

export const ETIQUETA_STAGE: Record<InventoryStage, string> = {
  taller: 'Taller',
  en_servicio: 'En servicio',
  almacen: 'Almacén',
}

export const FABRICANTES = ['alstom_metropolis9000', 'ansaldo_mb300'] as const
export type Fabricante = (typeof FABRICANTES)[number]

export const ETIQUETA_FABRICANTE: Record<Fabricante, string> = {
  alstom_metropolis9000: 'Alstom',
  ansaldo_mb300: 'Ansaldo',
}

export interface LadoInventario {
  discoId: string
  tValue: number | null
  hValue: number | null
  rdValue: number | null
  estadoCalculado: EstadoDisco | null
}

export interface PosicionInventario {
  trenNumero: number
  modeloVagon: string
  numeroCoche: number
  bogieCodigo: string
  ejeNumero: number
}

// Una fila = UN EJE (par izquierdo/derecho que comparten serie), no un disco
// suelto — ver comentario de BrakeDisc.serie en el schema del backend.
export interface InventoryRow {
  clave: string
  serie: string | null
  stage: InventoryStage
  fase: FaseDisco
  lote: string | null
  fabricante: Fabricante | null
  marcaRueda: string | null
  posicion: PosicionInventario | null
  izquierdo: LadoInventario | null
  derecho: LadoInventario | null
  asociacion: string
  ultimoMovimiento: {
    tipo: 'retiro_masivo' | 'cambio_disco' | 'devolucion_almacen'
    fecha: string
    encargadoNombre: string
    supervisorNombre: string | null
    numeroPt: string | null
    justificacion: string | null
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

export interface PuntoRetirosMes {
  mes: string // YYYY-MM
  retirados: number
}

export interface CambiosDiscoAnio {
  anio: number
  total: number
}

export interface PuntoCambiosRealesMes {
  mes: string // YYYY-MM
  cambiosReales: number
}

export interface InventoryQuery {
  page: number
  pageSize: number
  stage?: InventoryStage[]
  fase?: FaseDisco[]
  fabricante?: Fabricante[]
  search?: string
}

export interface RegistrarEjeInput {
  serie: string
  lote?: string
  fabricante?: Fabricante
  marcaRueda?: string
  autoTaller?: boolean
}

export interface EditarEjeInput {
  serie?: string
  lote?: string
  fabricante?: Fabricante
  marcaRueda?: string
}
