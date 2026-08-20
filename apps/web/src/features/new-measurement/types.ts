// Ficha de medición individual (motivo 'Medición' — único implementado por
// ahora). Los contratos compartidos con migración/confirmados (fila/preview/
// paginación) viven en features/scan-records/types y se reexportan acá, mismo
// criterio que features/migration/types.ts.

export type {
  CampoInvalido,
  EstadoDisco,
  LadoDisco,
  MotivoInvalido,
  PreviewParams,
  PreviewResult,
  PreviewRow,
} from '../scan-records/types'

// Espejo de MOTIVOS_RECONOCIDOS (apps/api/src/new-measurement/new-measurement-csv.parser.ts).
export const MOTIVOS_FICHA = ['Medición', 'Reperfilado', 'Cambio'] as const
export type MotivoFicha = (typeof MOTIVOS_FICHA)[number]
export type TipoCoche = 'MA1' | 'MB1' | 'MB3' | 'REM' | 'MB2' | 'MA2'
export type CodigosCoche = Partial<Record<TipoCoche, number>>
export type CodigosBogie = Partial<Record<string, string>>

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
  motivo: MotivoFicha
  codigosCoche: CodigosCoche | null
  codigosBogie: CodigosBogie | null
  puestoTrabajo: string | null
  fechaHoraInicio: string | null
  fechaHoraFin: string | null
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
  // P.T. (Puesto de Trabajo) — texto libre, siempre manual (el CSV nunca lo
  // trae). Obligatorio para bloquear (POST .../lock) y confirmar (POST
  // .../commit), mismo nivel que responsableMantenimientoNombre.
  ptCodigo: string | null
  createdAt: string
  tecnicos: FichaTecnico[]
  instrumentos: FichaInstrumento[]
  // Ciclo verificar -> bloquear -> confirmar (ver NewMeasurementValidationService).
  verificado: boolean
  tablaBloqueada: boolean
}

// Espejo de PreviewMedicionResult (new-measurement-preview.service.ts): la
// respuesta de GET /new-measurement/:fichaId/preview. kmInvalido/fechaInvalido
// viajan ÚNICAMENTE acá, a nivel raíz (nunca por fila, ver PreviewRow) —
// mismo criterio que ResumenVerificacion.
export interface PreviewFichaResult {
  ficha: FichaMedicion
  esqueleto: PosicionEsqueleto[]
  rows: import('../scan-records/types').PreviewRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  totalPaginas: number
  kmInvalido: { motivo: string } | null
  fechaInvalido: { motivo: string } | null
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

// Respuesta de POST /new-measurement/upload cuando el CSV coincide
// EXACTAMENTE (fecha + kilometraje + cada H/T de cada disco presente) con la
// última ficha CONFIRMADA de ese mismo tren — la ficha borrador NUNCA se crea
// en este caso, sin excepción: no existe ningún camino para forzar esta carga
// puntual, la única forma de continuar es subir un archivo distinto — ver
// CargaInicialFicha.
export interface ResultadoDuplicadoDetectado {
  duplicadoDetectado: true
  fichaConfirmadaId: string
  fecha: string
  kilometraje: number
  tren: number
  // 'confirmada': coincide con la última ficha CONFIRMADA de este tren.
  // 'reinicio': coincide con lo que tenía la ficha justo antes de un
  // "Resubir CSV"/"Reiniciar ficha" reciente sobre este mismo tren.
  origen: 'confirmada' | 'reinicio'
}

export type TipoEventoHistorialMedicion =
  | 'csv_subido'
  | 'csv_duplicado_bloqueado'
  | 'ficha_creada_manual'
  | 'ficha_reiniciada'
  | 'ficha_cancelada'
  | 'ficha_bloqueada'
  | 'ficha_confirmada'

export interface EventoHistorialApi {
  id: string
  tipo: TipoEventoHistorialMedicion
  trenNumero: number
  fichaId: string | null
  nombreArchivo: string | null
  usuarioNombre: string
  detalle: string | null
  createdAt: string
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

// Respuesta de POST /new-measurement/:fichaId/reset ("Resubir CSV" /
// "Reiniciar ficha") — espejo de ResumenReset (new-measurement-commit.service.ts).
export interface ResumenReset {
  fichaId: string
  fileId: string
  registrosEliminados: number
}

// Espejo de FilaExcluida (new-measurement-validation.service.ts).
export interface FilaExcluidaVerificacion {
  recordId: string
  eje: number | null
  lado: string | null
  motivos: import('../scan-records/types').MotivoInvalido[]
}

// Respuesta de POST /new-measurement/:fichaId/validate. filasExcluidas viene
// YA ORDENADO por el mismo criterio jerárquico que el resto del sistema
// (eje/lado físico) — se renderiza tal cual, sin reordenar en el frontend.
export interface ResumenVerificacion {
  todoValido: boolean
  filasExcluidas: FilaExcluidaVerificacion[]
  filasIncluidas: number
  // kmInvalido/fechaInvalido aplican a nivel FICHA (no a una fila puntual).
  kmInvalido: { motivo: string } | null
  fechaInvalido: { motivo: string } | null
  alertasReperfilado: string[]
}

// Respuesta de POST /new-measurement/:fichaId/lock.
export interface ResumenBloqueo {
  fichaId: string
  tablaBloqueada: boolean
}

// Espejo de TipoReferencia (dto/reference-query.dto.ts).
export const TIPOS_REFERENCIA = ['ultima_medicion', 'ultima_ficha'] as const
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number]

// Espejo de ResultadoReferencia (new-measurement-reference.service.ts) — GET
// /new-measurement/reference?tren=&tipo=. `disponible` discrimina la unión;
// `fecha` (ultima_medicion) vs. `fechaFicha` (ultima_ficha) reflejan el mismo
// nombre distinto que usa el backend a propósito (ver comentario ahí: la
// fecha de una MEDICIÓN puntual no es lo mismo que la fecha de LA FICHA).
export interface ReferenciaNoDisponible {
  disponible: false
}

export interface ReferenciaUltimaMedicion {
  disponible: true
  tren: number
  fecha: string
  kilometraje: number
  responsable: string
  esqueleto: PosicionEsqueleto[]
  rows: import('../scan-records/types').PreviewRow[]
}

// A diferencia de ReferenciaUltimaMedicion (que no proviene de ninguna ficha
// real, solo de ScanRecords individuales), acá SÍ hay una ficha histórica
// completa detrás — por eso trae también Lista de Instrumentos y Realizado
// por/Ing. MR/Responsable de Mantenimiento, que ModalMedicionAnterior
// muestra en modo solo lectura solo para esta opción (punto 7).
export interface ReferenciaUltimaFicha {
  disponible: true
  tren: number
  fechaFicha: string
  kilometraje: number
  responsable: string | null
  // P.T. de ESA ficha histórica — exclusivo de 'ultima_ficha' (no existe en
  // ReferenciaUltimaMedicion, que no proviene de ninguna ficha real).
  ptCodigo: string | null
  esqueleto: PosicionEsqueleto[]
  rows: import('../scan-records/types').PreviewRow[]
  responsableMantenimientoFirma: string | null
  responsableMantenimientoFecha: string | null
  ingMrNombre: string | null
  ingMrFirma: string | null
  ingMrFecha: string | null
  tecnicos: FichaTecnico[]
  instrumentos: FichaInstrumento[]
}

export type ResultadoReferencia =
  | ReferenciaNoDisponible
  | ReferenciaUltimaMedicion
  | ReferenciaUltimaFicha

// Payload de edición de cabecera — todos opcionales, se envía solo lo que
// cambia (espejo de UpdateFichaDto).
export interface CambiosFicha {
  codigosCoche?: CodigosCoche
  codigosBogie?: CodigosBogie
  trenNumero?: number
  kilometraje?: number
  fechaFicha?: string
  puestoTrabajo?: string
  fechaHoraInicio?: string
  fechaHoraFin?: string
  todasConformes?: boolean
  comentariosActividad?: string
  responsableMantenimientoNombre?: string
  responsableMantenimientoFirma?: string
  responsableMantenimientoFecha?: string
  ingMrNombre?: string
  ingMrFirma?: string
  ingMrFecha?: string
  ptCodigo?: string
  tecnicos?: {
    posicion: number
    nombre?: string
    firma?: string
    fecha?: string
  }[]
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
  rugosidadRa?: number | null
  reperfiladoTAntes?: number
  reperfiladoHAntes?: number
  fecha?: string
  observacion?: string
}

// Payload de PATCH .../records/:id (espejo de UpdateFilaDto) — todo opcional.
export interface EditarFilaFicha {
  fecha?: string
  hValue?: number
  tValue?: number
  rugosidadRa?: number
  reperfiladoTAntes?: number
  reperfiladoHAntes?: number
  ejeNumero?: number
  lado?: 'izquierdo' | 'derecho'
  observacion?: string
}
