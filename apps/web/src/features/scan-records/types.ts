// Contratos compartidos entre la vista previa de una migración en curso
// (features/migration, acotada por fileId) y la vista permanente de
// mediciones confirmadas (este feature, sin fileId) — mismo shape de
// respuesta en ambos modos, espejo de apps/api/src/scan-records/scan-record-query.ts.

// REPERFILADO: quinto estado posible (espejo de EstadoDiscoAmpliado en
// apps/api/src/brake-disc-rules/brake-disc-rules.engine.ts) — Rd manda salvo
// que H llegue al umbral de reperfilado y el resultado post-descuento siga
// fuera de zona de Cambio. Es un valor más del chip de Estado, no una
// etiqueta aparte.
export type EstadoDisco = 'OK' | 'SEGUIMIENTO' | 'CAMBIO' | 'CRITICO' | 'REPERFILADO'

// Espejo de LadoDisco (generated/prisma) y de VistaFecha/VISTAS_FECHA
// (apps/api/src/migration/dto/preview-query.dto.ts).
export type LadoDisco = 'izquierdo' | 'derecho'

export const VISTAS_FECHA = ['todas', 'ultima', 'primera'] as const
export type VistaFecha = (typeof VISTAS_FECHA)[number]

// Campos soportados por GET .../valores-distintos?campo= (ver
// CAMPOS_VALORES_DISTINTOS en el backend) — únicos 2 por ahora.
export const CAMPOS_VALORES_DISTINTOS = ['motivo', 'responsable'] as const
export type CampoValoresDistintos = (typeof CAMPOS_VALORES_DISTINTOS)[number]

// Espejo de AccionRecomendada (apps/api/src/brake-disc-rules/brake-disc-rules.engine.ts).
// Ya NO aplica a Migración/Mediciones (ver PreviewRow) — sigue en uso
// exclusivo de Tasa de Desgaste (features/wear-rate), que cruza ambos lados
// del eje de forma independiente.
export type AccionRecomendada = 'CRITICO' | 'CAMBIO' | 'REPERFILADO' | 'NINGUNA'

// Espejo de CampoInvalido/MotivoInvalido (apps/api/src/scan-records/scan-record-query.ts).
export type CampoInvalido = 't' | 'rd' | 'kilometraje' | 'fecha'

export interface MotivoInvalido {
  campo: CampoInvalido
  motivo: string
}

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
  // Exclusivo de features/new-measurement (ficha de medición individual) —
  // null en filas de migración/confirmados normales.
  observacion: string | null
  // Flags de validación cruzada automática POR FILA — exclusivos de
  // features/new-measurement (siempre false en filas de migración/
  // confirmados normales). kmInvalido/fechaInvalido NO viajan acá: son a
  // nivel FICHA (mismo valor en las ~48 filas), así que se exponen UNA sola
  // vez a nivel raíz de la respuesta (ver PreviewFichaResult/ResumenVerificacion
  // en features/new-measurement/types.ts) — nunca replicados por fila.
  tInvalido: boolean
  rdInvalido: boolean
  // Espejo legible de los 2 flags de arriba — permite repintar el motivo de
  // cada fila desde /preview sin volver a llamar a POST .../validate. Vacío
  // cuando ambos están en false.
  motivos: MotivoInvalido[]
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
  reperfilado: number
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
  // 'todas' (default) = sin colapsar. 'ultima'/'primera' devuelven una sola
  // fila por disco físico (la de fecha más reciente o más antigua de ese disco).
  vistaFecha?: VistaFecha
  // Poblados dinámicamente desde GET .../valores-distintos — no hay una lista
  // fija en el backend (motivo/responsable son texto libre del Excel).
  motivo?: string[]
  responsable?: string[]
  lado?: LadoDisco[]
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
