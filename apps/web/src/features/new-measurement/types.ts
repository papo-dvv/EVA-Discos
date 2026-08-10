// Ficha de medición individual (motivo 'Medición' — único implementado por
// ahora). Los contratos compartidos con migración/confirmados (fila/preview/
// paginación) viven en features/scan-records/types y se reexportan acá, mismo
// criterio que features/migration/types.ts.

export type {
  LadoDisco,
  PreviewParams,
  PreviewResult,
  PreviewRow,
} from '../scan-records/types'

// Espejo de MOTIVOS_RECONOCIDOS (apps/api/src/new-measurement/new-measurement-csv.parser.ts).
export const MOTIVOS_FICHA = ['Medición', 'Reperfilado', 'Cambio'] as const
export type MotivoFicha = (typeof MOTIVOS_FICHA)[number]

// Espejo de PosicionEsqueleto (apps/api/src/new-measurement/new-measurement-esqueleto.ts).
export interface PosicionEsqueleto {
  ejeNumero: number
  lado: 'izquierdo' | 'derecho'
  tipoCoche: string
  bogieCodigo: string
  ruedaNumero: number
  numeroCoche: number | null
}

export interface FichaTecnico {
  posicion: number
  nombre: string | null
  firma: string | null
  fecha: string | null
}

export interface FichaInstrumento {
  posicion: number
  codigo: string | null
  descripcion: string | null
  modeloMarca: string | null
  fechaCalibracion: string | null
  fechaVencimientoCalibracion: string | null
  observaciones: string | null
}

// Espejo de FichaDetalle (apps/api/src/new-measurement/new-measurement-preview.service.ts).
export interface FichaMedicion {
  id: string
  uploadedFileId: string | null
  trenNumero: number
  kilometraje: number
  fechaFicha: string
  actividad: string
  trenOriginalCsv: number | null
  corregidoTren: boolean
  kilometrajeOriginalCsv: number | null
  corregidoKilometraje: boolean
  todasConformes: boolean | null
  comentariosActividad: string | null
  responsableMantenimientoNombre: string | null
  responsableMantenimientoFirma: string | null
  responsableMantenimientoFecha: string | null
  ingMrNombre: string | null
  ingMrFirma: string | null
  ingMrFecha: string | null
  createdAt: string
  tecnicos: FichaTecnico[]
  instrumentos: FichaInstrumento[]
}

// Espejo de PreviewMedicionResult (new-measurement-preview.service.ts): la
// respuesta de GET /new-measurement/:fichaId/preview.
export interface PreviewFichaResult {
  ficha: FichaMedicion
  esqueleto: PosicionEsqueleto[]
  rows: import('../scan-records/types').PreviewRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  totalPaginas: number
}

export interface DiscrepanciaRd {
  measPointName: string
  rdCsv: number
  rdCalculado: number
}

export interface FilaMedicionInvalida {
  measPointName: string
  motivo: string
}

export interface ResumenCargaMedicion {
  fichaId: string
  fileId: string
  trenNumero: number
  kilometraje: number
  discosDetectados: number
  discosValidos: number
  filasInvalidas: FilaMedicionInvalida[]
  discrepanciasRd: DiscrepanciaRd[]
}

export interface ResumenFichaManual {
  fichaId: string
  trenNumero: number
  kilometraje: number
  esqueleto: PosicionEsqueleto[]
}

export interface ResumenCommitMedicion {
  fichaId: string
  fileId: string
  status: string
  totalFilas: number
  discosResueltos: number
}

// Payload de edición de cabecera — todos opcionales, se envía solo lo que
// cambia (espejo de UpdateFichaDto).
export interface CambiosFicha {
  trenNumero?: number
  kilometraje?: number
  fechaFicha?: string
  todasConformes?: boolean
  comentariosActividad?: string
  responsableMantenimientoNombre?: string
  responsableMantenimientoFirma?: string
  responsableMantenimientoFecha?: string
  ingMrNombre?: string
  ingMrFirma?: string
  ingMrFecha?: string
  tecnicos?: { posicion: number; nombre?: string; firma?: string; fecha?: string }[]
  instrumentos?: {
    posicion: number
    codigo?: string
    descripcion?: string
    modeloMarca?: string
    fechaCalibracion?: string
    fechaVencimientoCalibracion?: string
    observaciones?: string
  }[]
}

// Payload de POST .../records (espejo de AgregarFilaDto) — H y T son
// obligatorios: el backend no admite crear una fila con solo uno de los dos.
export interface AgregarFilaFicha {
  ejeNumero: number
  lado: 'izquierdo' | 'derecho'
  hValue: number
  tValue: number
  fecha?: string
  observacion?: string
}

// Payload de PATCH .../records/:id (espejo de UpdateFilaDto) — todo opcional.
export interface EditarFilaFicha {
  fecha?: string
  hValue?: number
  tValue?: number
  ejeNumero?: number
  lado?: 'izquierdo' | 'derecho'
  observacion?: string
}
