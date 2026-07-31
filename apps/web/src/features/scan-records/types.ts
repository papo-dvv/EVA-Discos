// Contratos compartidos entre la vista previa de una migración en curso
// (features/migration, acotada por fileId) y la vista permanente de
// mediciones confirmadas (este feature, sin fileId) — mismo shape de
// respuesta en ambos modos, espejo de apps/api/src/scan-records/scan-record-query.ts.

export type EstadoDisco = 'OK' | 'SEGUIMIENTO' | 'CAMBIO' | 'CRITICO'

// Espejo de AccionRecomendada/LadoAfectado (apps/api/src/brake-disc-rules/brake-disc-rules.engine.ts).
// Es una propiedad DEL EJE (coche+bogie+eje), calculada por el backend
// cruzando la medición más reciente de ambos lados — nunca se recalcula acá.
export type AccionRecomendada = 'CRITICO' | 'CAMBIO' | 'REPERFILADO' | 'NINGUNA'
export type LadoAfectado = 'izquierdo' | 'derecho' | 'ambos' | null

export interface PreviewRow {
  id: string
  responsableNombre: string
  trenNumero: number
  kilometraje: number
  fecha: string
  motivo: string
  cocheExcel: string | null
  numeroCocheExcel: number | null
  bogieExcel: string | null
  ejeExcel: number | null
  ruedaExcel: number | null
  ubicacionExcel: string | null
  hValue: number
  tValue: number
  rdValue: number
  estadoCalculado: EstadoDisco | null
  estadoSugeridoExcel: string | null
  corregidoPorHoja: boolean
  trenOriginalExcel: number | null
  discrepanciaEstadoExcel: boolean
  hojaExcelOrigen: string | null
  accionRecomendada: AccionRecomendada | null
  ladoAfectado: LadoAfectado
}

export interface PreviewResult {
  rows: PreviewRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // Alias en español para el selector de página numérico (== totalPages).
  totalPaginas: number
}

// Conteo por estado de un subconjunto de filas (de la carga, o de todas las
// confirmadas, según el modo).
export interface ConteoPorEstado {
  ok: number
  seguimiento: number
  cambio: number
  critico: number
}

export interface StatsScanRecords {
  // Total del subconjunto base, sin importar filtro — tarjeta "Total de datos".
  totalFilasSubidas: number
  total: ConteoPorEstado
  filtrado: ConteoPorEstado
}

// Opciones reales de los multi-selects del panel de filtros (distinct entre
// las filas del subconjunto base: la carga en curso, o todas las confirmadas).
export interface OpcionesFiltro {
  tiposCoche: string[]
  bogies: string[]
}

export interface ResumenTren {
  tren: number
  totalFilas: number
  filasConAdvertencia: number
}

export type ColumnaOrdenable =
  | 'responsable'
  | 'kilometraje'
  | 'fecha'
  | 'motivo'
  | 'coche'
  | 'numeroCoche'
  | 'bogie'
  | 'eje'
  | 'rueda'
  | 'h'
  | 't'
  | 'rd'
  | 'estado'

export interface PreviewParams {
  tren?: number
  page: number
  pageSize: number
  search?: string
  // Ausentes = orden físico predefinido del backend (tren→coche→bogie→eje→
  // lado, ver ORDEN_FISICO_DEFECTO): la carga inicial de la tabla NUNCA manda
  // estos dos, solo aparecen tras un click explícito en un encabezado
  // ordenable (ver MigracionPreview/MedicionesConfirmadas).
  sortBy?: ColumnaOrdenable
  sortDir?: 'asc' | 'desc'
  // Filtros combinables. modoCombinacion aplica a TODOS a la vez (default AND).
  modoCombinacion?: 'AND' | 'OR'
  tipoCoche?: string[]
  bogieCodigo?: string[]
  estado?: EstadoDisco[]
  accionRecomendada?: AccionRecomendada[]
  // true = corregido por hoja O con discrepancia; false = sin ninguno.
  corregidoOAdvertencia?: boolean
  fechaDesde?: string
  fechaHasta?: string
  kilometrajeMin?: number
  kilometrajeMax?: number
  hMin?: number
  hMax?: number
  tMin?: number
  tMax?: number
  rdMin?: number
  rdMax?: number
  ejeMin?: number
  ejeMax?: number
  ruedaMin?: number
  ruedaMax?: number
}

// Campos editables de una fila (subconjunto de PreviewRow). trenNumero solo
// aplica en modo borrador — el backend de confirmados (PATCH /scan-records/:id)
// no lo acepta, así que el modal de edición lo oculta según el modo.
export interface CambiosFila {
  responsableNombre?: string
  trenNumero?: number
  kilometraje?: number
  fecha?: string
  motivo?: string
  hValue?: number
  tValue?: number
}

// Alcance de un pedido: con fileId apunta al borrador de esa carga
// (/migration/:fileId/...); sin fileId apunta a la vista permanente de
// confirmados (/scan-records...). Un solo shape para toda la familia de hooks
// mode-aware de queries.ts.
export interface AlcanceScanRecords {
  fileId?: string
}
