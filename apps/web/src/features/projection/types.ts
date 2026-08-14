// Espejo de apps/api/src/projection: proyección de reperfilado y cambio por
// disco, tasa promedio de desgaste por tipo de coche (base del modelo) y
// pronóstico agregado a 12 meses.

import type { EstadoDisco, LadoDisco } from '../scan-records/types'

export interface PosicionDisco {
  tipoCoche: string
  numeroCoche: number
  bogieCodigo: string
  ejeNumero: number
  lado: LadoDisco
}

export interface CicloReperfilado {
  numero: number
  mesesHastaFecha: number
  fechaEstimada: string
  hEnEseMomento: number
  tEnEseMomento: number
  rdAntes: number
  rdDespues: number
  // Presente SOLO cuando este ciclo (numero=1) fue antepuesto por el lado
  // hermano de este eje (izquierdo/derecho) por ser más próximo — la fecha
  // que ESTE disco hubiera tenido si se proyectara de forma independiente.
  // null en cualquier otro caso (ciclo propio). Ver PosicionDisco.lado del
  // propio disco para saber a quién pertenece "la" fecha mostrada (el lado
  // opuesto) — usado por el ícono de referencia cruzada de TablaProyeccion.
  fechaPropiaSiFueraIndependiente: string | null
}

export interface CicloCambio {
  mesesHastaFecha: number
  fechaEstimada: string
  // Mismo criterio que CicloReperfilado.fechaPropiaSiFueraIndependiente.
  fechaPropiaSiFueraIndependiente: string | null
}

export interface FilaProyeccion {
  discId: string
  trenNumero: number
  posicion: PosicionDisco
  fechaUltimaMedicion: string
  h: number
  t: number
  rd: number
  // Incluye REPERFILADO (clasificarEstadoConReperfilado) — mismo enum
  // ampliado que ya usan Mediciones/Migración.
  estado: EstadoDisco
  // false = sin tasa de desgaste suficiente para el tipo de coche de este
  // disco (ver `motivo`) — h/t/rd/estado siguen siendo los reales (última
  // medición), solo faltan los ciclos futuros.
  proyectable: boolean
  motivo: string | null
  ciclosReperfilado: CicloReperfilado[]
  // Siempre presente cuando proyectable=true — el backend ya no trunca el
  // cálculo (sin cap de ciclos de reperfilado, ver ProyeccionCalculatorEngine
  // en el backend): null SOLO cuando proyectable=false.
  cicloCambio: CicloCambio | null
}

export interface ProyeccionDiscosResult {
  rows: FilaProyeccion[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  totalPaginas: number
}

export interface ProyeccionDiscosParams {
  tren?: number
  page: number
  pageSize: number
  // Filtros combinables — TODOS derivados de la proyección de cada disco
  // (ninguno es una columna real), ver ProyeccionService en el backend.
  modoCombinacion?: 'AND' | 'OR'
  estado?: EstadoDisco[]
  siguienteReperfiladoDesde?: string
  siguienteReperfiladoHasta?: string
  siguienteCambioDesde?: string
  siguienteCambioHasta?: string
  hMin?: number
  hMax?: number
  tMin?: number
  tMax?: number
  rdMin?: number
  rdMax?: number
  // eje/rueda SÍ son columnas reales de BrakeDisc (WHERE nativo en el
  // backend); lado también. motivo/responsable son filtros derivados de la
  // ÚLTIMA MEDICIÓN del disco (la que ancla la proyección) — ver
  // ProyeccionService (backend). Sin vistaFecha a propósito: la proyección
  // siempre parte de la medición más reciente, no hay "vista" que alternar.
  ejeMin?: number
  ejeMax?: number
  ruedaMin?: number
  ruedaMax?: number
  lado?: LadoDisco[]
  motivo?: string[]
  responsable?: string[]
}

export interface PromedioPorVagon {
  tipoCoche: string
  tasaPromedio: number | null
}

export interface DesgloseEstado {
  ok: number
  seguimiento: number
  cambio: number
  critico: number
  reperfilado: number
}

export interface PronosticoMes {
  mes: string // YYYY-MM
  reperfilados: number
  cambios: number
  desgloseEstado: DesgloseEstado
}

// Espejo de RANGOS_PRONOSTICO_MESES (apps/api/src/projection/dto/proyeccion-pronostico-query.dto.ts).
export const RANGOS_PRONOSTICO_MESES = [12, 24, 36, 48, 60] as const
export type RangoPronosticoMeses = (typeof RANGOS_PRONOSTICO_MESES)[number]
