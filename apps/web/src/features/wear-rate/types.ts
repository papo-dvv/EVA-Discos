// Espejo de apps/api/src/wear-rate: tasa de desgaste precomputada por pares
// de mediciones CONSECUTIVAS del mismo disco físico (fecha1 = n, fecha2 = n+1).

import type { AccionRecomendada, EstadoDisco } from '../scan-records/types'

export interface FilaWearRate {
  id: string
  discId: string
  trenNumero: number
  fecha1: string
  km1: number
  rd1: number
  fecha2: string
  km2: number
  rd2: number
  motivo2: string
  diferenciaKm: number
  diferenciaRd: number
  tasa: number
  // Decimales variables (7 a 9) calculados por el backend — ver formatearTasa
  // en WearRateCalculatorService. Se muestra tal cual, nunca se reformatea acá.
  tasaFormateada: string
  kmMensualUsado: number
  tasaMensual: number
  tasaMensualFormateada: string
  comentario: string
  esValido: boolean
  // Identidad del disco, denormalizada por el backend — alimenta la columna
  // desplegable de la tabla (ver TablaWearRate).
  tipoCoche: string
  numeroCoche: number
  bogieCodigo: string
  ejeNumero: number
  lado: string
}

export interface WearRatePairsResult {
  rows: FilaWearRate[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  totalPaginas: number
}

export type ColumnaOrdenableWearRate =
  | 'trenNumero'
  | 'fecha1'
  | 'fecha2'
  | 'km1'
  | 'km2'
  | 'rd1'
  | 'rd2'
  | 'diferenciaKm'
  | 'diferenciaRd'
  | 'tasa'
  | 'tasaMensual'
  | 'esValido'
  | 'createdAt'

export interface WearRatePairsParams {
  tren?: number
  page: number
  pageSize: number
  // Ausentes = orden físico predefinido del backend: la carga inicial de la
  // tabla NUNCA manda estos dos, solo aparecen tras un click explícito en un
  // encabezado ordenable (ver TasaDesgaste.tsx) — mismo criterio que
  // PreviewParams (features/scan-records/types.ts).
  sortBy?: ColumnaOrdenableWearRate
  sortDir?: 'asc' | 'desc'
  // Filtros combinables, exclusivos de /wear-rate/pairs — NUNCA se mandan a
  // /wear-rate/chart ni /wear-rate/summary (ver features/wear-rate/queries.ts:
  // esos hooks solo dependen de `tren`, con su propia query key separada).
  // modoCombinacion aplica a TODOS los filtros activos a la vez (default AND).
  modoCombinacion?: 'AND' | 'OR'
  tipoCoche?: string[]
  bogieCodigo?: string[]
  lado?: string[]
  motivoFecha2?: string[]
  estado?: EstadoDisco[]
  accionRecomendada?: AccionRecomendada[]
  soloInvalidos?: boolean
  fecha1Desde?: string
  fecha1Hasta?: string
  fecha2Desde?: string
  fecha2Hasta?: string
  km1Min?: number
  km1Max?: number
  km2Min?: number
  km2Max?: number
  rd1Min?: number
  rd1Max?: number
  rd2Min?: number
  rd2Max?: number
  diferenciaKmMin?: number
  diferenciaKmMax?: number
  diferenciaRdMin?: number
  diferenciaRdMax?: number
  tasaMin?: number
  tasaMax?: number
  tasaMensualMin?: number
  tasaMensualMax?: number
  ejeNumeroMin?: number
  ejeNumeroMax?: number
}

export interface PuntoChartWearRate {
  mes: string // YYYY-MM
  tasaMensualPromedio: number | null
  paresValidos: number
  paresInvalidos: number
}

export interface MotivoInvalidezFrecuencia {
  motivo: string
  cantidad: number
}

export interface WearRateSummary {
  paresValidos: number
  paresInvalidos: number
  motivosFrecuentes: MotivoInvalidezFrecuencia[]
}
