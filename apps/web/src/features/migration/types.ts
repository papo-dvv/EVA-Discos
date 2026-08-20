// Tipos EXCLUSIVOS de la migración masiva (subir Excel, resumen de la carga).
// Los contratos compartidos con la vista permanente de confirmados
// (fila/preview/stats/filtros/paginación) viven en features/scan-records/types
// y se reexportan acá para no romper los imports ya existentes en este feature.

export type {
  AlcanceScanRecords,
  CambiosFila,
  CampoValoresDistintos,
  ColumnaOrdenable,
  ConteoPorEstado,
  EstadoDisco,
  LadoDisco,
  OpcionesFiltro,
  PreviewParams,
  PreviewResult,
  PreviewRow,
  ResumenTren,
  StatsScanRecords as StatsMigracion,
  VistaFecha,
} from '../scan-records/types'

export interface Discrepancia {
  hoja: string
  filaExcel: number
  tipo: 'tren' | 'estado' | 'numero_coche'
  valorExcel: string | number | null
  valorSistema: string | number
}

export interface FilaInvalida {
  hoja: string
  fila: number
  motivo: string
}

export interface HojaConError {
  hoja: string
  motivo: string
}

export interface ResumenMigracion {
  fileId: string
  totalHojasProcesadas: number
  totalFilasLeidas: number
  filasVaciasOmitidas: number
  filasValidas: number
  filasInvalidas: FilaInvalida[]
  filasConAdvertencia: number
  hojasFaltantes: string[]
  hojasConError: HojaConError[]
  detalleDiscrepancias: Discrepancia[]
}

export type TipoEventoHistorialMigracion =
  'migracion_subida' | 'migracion_confirmada' | 'migracion_cancelada'

export interface EventoHistorialMigracionApi {
  id: string
  tipo: TipoEventoHistorialMigracion
  fileId: string | null
  nombreArchivo: string | null
  alcance: string | null
  marca: string | null
  trenNumero: number | null
  totalFilas: number | null
  filasValidas: number | null
  filasInvalidas: number | null
  detalle: string | null
  usuarioNombre: string
  createdAt: string
}
