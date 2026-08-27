import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type {
  FaseDisco,
  InventoryStage,
  ModeloTren,
} from '../../../generated/prisma';
import { aArray } from '../../migration/dto/preview-query.dto';

export const INVENTORY_STAGES = [
  'almacen',
  'taller',
  'en_servicio',
] as const satisfies readonly InventoryStage[];
export const FASES_DISCO = [
  'nueva',
  'usada',
] as const satisfies readonly FaseDisco[];
export const FABRICANTES_DISCO = [
  'alstom_metropolis9000',
  'ansaldo_mb300',
] as const satisfies readonly ModeloTren[];

// Query de GET /inventory — mismo espíritu que PreviewQueryDto (migración/
// mediciones) pero deliberadamente más chico: Inventario no necesita todavía
// el aparato completo de sortBy/rangos/vistaFecha de scan-record-query.ts.
export class InventoryQueryDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  pageSize = 25;

  // stage/fase llegan como un único valor (?stage=taller) cuando el frontend
  // filtra por una sola etapa — @IsArray() a secas rechazaba eso con 400
  // porque qs solo arma un array si la key se repite o trae []. Mismo
  // criterio que PreviewQueryDto (aArray): acepta escalar, repetición o coma.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(INVENTORY_STAGES, { each: true })
  stage?: InventoryStage[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(FASES_DISCO, { each: true })
  fase?: FaseDisco[];

  // Modelo de tren compatible (Alstom/Ansaldo) — usado por el filtro de
  // flota del modal de Retiro Masivo, entre otros.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsArray()
  @IsIn(FABRICANTES_DISCO, { each: true })
  fabricante?: ModeloTren[];

  // Texto libre: matchea serie, marcaRueda o el nombre del proveedor.
  @IsOptional()
  @IsString()
  search?: string;
}
