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
import { LadoDisco, TipoCoche } from '../../../generated/prisma';
import type { AccionRecomendada } from '../../brake-disc-rules/brake-disc-rules.engine';
import {
  ACCIONES_RECOMENDADAS,
  ESTADOS_DISCO,
  aArray,
  aBoolean,
} from '../../migration/dto/preview-query.dto';

// Columnas ordenables de la tabla /wear-rate/pairs. Coinciden 1:1 con los
// campos de WearRatePair en Prisma, así que no hace falta un mapeo aparte
// (a diferencia de PreviewQueryDto/ScanRecord).
export const COLUMNAS_ORDENABLES_WEAR_RATE = [
  'trenNumero',
  'fecha1',
  'fecha2',
  'km1',
  'km2',
  'rd1',
  'rd2',
  'diferenciaKm',
  'diferenciaRd',
  'tasa',
  'tasaMensual',
  'esValido',
  'createdAt',
] as const;

export type ColumnaOrdenableWearRate =
  (typeof COLUMNAS_ORDENABLES_WEAR_RATE)[number];

// tipo_coche y lado quedaron denormalizados como los enums reales de Prisma
// (ver schema): se validan contra el enum, igual que `estado` en
// PreviewQueryDto. bogie_codigo en cambio sigue siendo texto libre (catálogo
// BogieCatalog, no un enum cerrado) — mismo criterio que bogieExcel en
// scan-records.
const TIPOS_COCHE_VALORES = Object.values(TipoCoche);
const LADOS_VALORES = Object.values(LadoDisco);
// motivo_2 es texto libre en la base (igual que ScanRecord.motivo), pero este
// filtro solo ofrece los 3 valores relevantes para las reglas de invalidez
// del cálculo (ver WearRateCalculatorService) — un motivo real distinto de
// estos tres simplemente no es filtrable por acá.
const MOTIVOS_FECHA2 = ['Medición', 'Reperfilado', 'Cambio'] as const;

export class WearRatePairsQueryDto {
  // Omitir tren = vista global (todos los trenes).
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

  // Sin default a propósito: ausente = orden físico predefinido (tren, coche,
  // bogie, eje, lado). Un sortBy explícito del frontend tiene prioridad.
  @IsOptional()
  @IsIn(COLUMNAS_ORDENABLES_WEAR_RATE)
  sortBy?: ColumnaOrdenableWearRate;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  // Modo de combinación de TODOS los filtros activos a la vez (incluido
  // `tren`): 'AND' exige que el par cumpla todos; 'OR' que cumpla cualquiera.
  // Mismo comportamiento que en PreviewQueryDto/scan-records.
  @IsOptional()
  @IsIn(['AND', 'OR'])
  modoCombinacion?: 'AND' | 'OR' = 'AND';

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(TIPOS_COCHE_VALORES, { each: true })
  tipoCoche?: TipoCoche[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsString({ each: true })
  bogieCodigo?: string[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(LADOS_VALORES, { each: true })
  lado?: LadoDisco[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(MOTIVOS_FECHA2, { each: true })
  motivoFecha2?: string[];

  // WearRatePair no tiene una columna estadoCalculado propia (a diferencia
  // de ScanRecord) — se traduce a un rango de rd2 con los umbrales vigentes
  // (ver construirWhereWearRate/rangoParaEstado en wear-rate-pairs-query.ts),
  // así que SÍ es un WHERE normal, a diferencia de accionRecomendada.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(ESTADOS_DISCO, { each: true })
  estado?: EstadoDisco[];

  // Igual que en PreviewQueryDto: NUNCA se traduce a un WHERE (se calcula
  // cruzando discos vía discId) — el servicio lo aplica aparte, después de
  // enriquecer todo el conjunto sin paginar (ver WearRateService.buscarPares).
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(ACCIONES_RECOMENDADAS, { each: true })
  accionRecomendada?: AccionRecomendada[];

  // true = solo pares inválidos (es_valido=false); false = solo válidos;
  // ausente = sin filtro. Equivalente a corregidoOAdvertencia en mediciones.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value))
  @IsBoolean()
  soloInvalidos?: boolean;

  // Dos rangos de fecha independientes: fecha1 y fecha2.
  @IsOptional()
  @IsISO8601()
  fecha1Desde?: string;

  @IsOptional()
  @IsISO8601()
  fecha1Hasta?: string;

  @IsOptional()
  @IsISO8601()
  fecha2Desde?: string;

  @IsOptional()
  @IsISO8601()
  fecha2Hasta?: string;

  // Rangos min/max por campo numérico. Todos opcionales e independientes.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  km1Min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  km1Max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  km2Min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  km2Max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rd1Min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rd1Max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rd2Min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rd2Max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diferenciaKmMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diferenciaKmMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diferenciaRdMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diferenciaRdMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tasaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tasaMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tasaMensualMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tasaMensualMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeNumeroMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeNumeroMax?: number;
}
