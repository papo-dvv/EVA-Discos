import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { FaseDisco, InventoryStage } from '../../../generated/prisma';

export const INVENTORY_STAGES = [
  'almacen',
  'taller',
  'en_servicio',
] as const satisfies readonly InventoryStage[];
export const FASES_DISCO = [
  'nueva',
  'usada',
] as const satisfies readonly FaseDisco[];

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

  @IsOptional()
  @IsArray()
  @IsIn(INVENTORY_STAGES, { each: true })
  @Type(() => String)
  stage?: InventoryStage[];

  @IsOptional()
  @IsArray()
  @IsIn(FASES_DISCO, { each: true })
  @Type(() => String)
  fase?: FaseDisco[];

  // Texto libre: matchea serie, marcaRueda o el nombre del proveedor.
  @IsOptional()
  @IsString()
  search?: string;
}
