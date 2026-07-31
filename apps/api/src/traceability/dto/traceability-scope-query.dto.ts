import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { TipoCoche } from '../../../generated/prisma';

const TIPOS_COCHE_VALORES = Object.values(TipoCoche);

// Scope genérico de trazabilidad: tren/tipoCoche/bogieCodigo son
// independientes entre sí y se combinan siempre en AND (a diferencia de los
// filtros de /wear-rate/pairs, acá no hay modoCombinacion — son dimensiones
// del alcance de los datos, no filtros de fila que el usuario alterne).
// Ninguno presente = vista general de toda la flota. Reutilizado por
// /summary y, vía herencia, por /series (ver TraceabilitySeriesQueryDto).
export class TraceabilityScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @IsOptional()
  @IsIn(TIPOS_COCHE_VALORES)
  tipoCoche?: TipoCoche;

  // Texto libre (catálogo BogieCatalog, no un enum cerrado) — mismo criterio
  // que bogieCodigo en wear-rate-pairs-query.dto.ts.
  @IsOptional()
  @IsString()
  bogieCodigo?: string;
}
