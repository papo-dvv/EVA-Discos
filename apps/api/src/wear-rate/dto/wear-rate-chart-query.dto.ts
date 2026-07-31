import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export class WearRateChartQueryDto {
  // Omitir tren = agrega across toda la flota.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  // Único agrupamiento soportado por ahora; queda explícito en la query para
  // no romper el contrato si a futuro se agregan otros (ej. 'week').
  @IsOptional()
  @IsIn(['month'])
  groupBy = 'month' as const;
}
