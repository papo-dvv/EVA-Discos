import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class WearRateSummaryQueryDto {
  // Omitir tren = resumen de toda la flota.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;
}
