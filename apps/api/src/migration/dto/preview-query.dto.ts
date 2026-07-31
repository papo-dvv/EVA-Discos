import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { EstadoDisco } from '../../../generated/prisma';
import type { AccionRecomendada } from '../../brake-disc-rules/brake-disc-rules.engine';

// Columnas por las que se puede ordenar la vista previa. El nombre público
// (izquierda) es el que usa el frontend; el mapeo al campo real de Prisma
// vive en el servicio.
export const COLUMNAS_ORDENABLES = [
  'responsable',
  'kilometraje',
  'fecha',
  'motivo',
  'coche',
  'numeroCoche',
  'bogie',
  'eje',
  'rueda',
  'h',
  't',
  'rd',
  'estado',
] as const;

export type ColumnaOrdenable = (typeof COLUMNAS_ORDENABLES)[number];

export const ESTADOS_DISCO = [
  'OK',
  'SEGUIMIENTO',
  'CAMBIO',
  'CRITICO',
] as const satisfies readonly EstadoDisco[];

// Distinto de ESTADOS_DISCO: accionRecomendada no es un estado del disco, es
// la recomendación cruzada del eje (ver BrakeDiscRulesEngine.evaluarAccionRecomendada).
// NINGUNA no se incluye a propósito: filtrar por "sin acción" no tiene un uso
// real (sería la inmensa mayoría de las filas) y ese valor ni siquiera se
// expone como chip en el frontend.
export const ACCIONES_RECOMENDADAS = [
  'CRITICO',
  'CAMBIO',
  'REPERFILADO',
] as const satisfies readonly AccionRecomendada[];

// Normaliza un parámetro de array de query: acepta tanto repetición
// (?estado=OK&estado=CRITICO) como coma (?estado=OK,CRITICO). Devuelve un
// array de strings sin vacíos, o undefined si no vino nada.
// Exportada: reutilizada tal cual por otros DTOs de filtros (ej.
// WearRatePairsQueryDto) — no es específica de la migración/scan-records.
export function aArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const bruto: unknown[] = Array.isArray(value) ? value : [value];
  const items = bruto
    .flatMap((v): string[] => (typeof v === 'string' ? v.split(',') : []))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return items.length > 0 ? items : undefined;
}

// Booleano tolerante para query params ('true'/'false' llegan como texto).
// Exportada por el mismo motivo que aArray — ver comentario arriba.
export function aBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class PreviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  // Sin default a propósito: ausente = orden físico predefinido (tren, coche,
  // bogie, eje, lado — ver ORDEN_FISICO_DEFECTO en scan-record-query.ts).
  // Un sortBy explícito del frontend tiene prioridad sobre ese orden.
  @IsOptional()
  @IsIn(COLUMNAS_ORDENABLES)
  sortBy?: ColumnaOrdenable;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'asc';

  // ── Filtros combinables ────────────────────────────────────────────────
  // Modo de combinación de TODOS los filtros activos a la vez: 'AND' exige que
  // la fila cumpla todos; 'OR' que cumpla cualquiera. No es por par de filtros.
  @IsOptional()
  @IsIn(['AND', 'OR'])
  modoCombinacion?: 'AND' | 'OR' = 'AND';

  // Filtra la columna "Coche" cruda del Excel (cocheExcel). Se valida como
  // texto libre (no contra el enum) porque el valor viene sin normalizar.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsString({ each: true })
  tipoCoche?: string[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsString({ each: true })
  bogieCodigo?: string[];

  // estadoCalculado SÍ es un enum del sistema: un valor fuera del enum es un
  // error del cliente y se rechaza.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(ESTADOS_DISCO, { each: true })
  estado?: EstadoDisco[];

  // A diferencia del resto de filtros, este NUNCA se traduce a un WHERE de
  // Prisma: accionRecomendada se calcula cruzando discos (ver
  // accion-recomendada.query.ts), no es una columna. El servicio que arma la
  // respuesta lo aplica aparte, DESPUÉS de enriquecer — ver
  // paginarFiltrandoPorAccion.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(ACCIONES_RECOMENDADAS, { each: true })
  accionRecomendada?: AccionRecomendada[];

  // Filtro combinado (un solo control): true = filas corregidas por hoja O con
  // discrepancia de estado; false = filas sin corrección Y sin discrepancia;
  // ausente = no se aplica.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value))
  @IsBoolean()
  corregidoOAdvertencia?: boolean;

  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;

  // Rangos min/max por campo numérico. Todos opcionales e independientes: se
  // puede enviar solo min, solo max o ambos.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kilometrajeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kilometrajeMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rdMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rdMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ruedaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ruedaMax?: number;
}
