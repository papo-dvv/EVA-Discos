import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class FleetCompletenessDetalleQueryDto {
  @Type(() => Number)
  @IsInt()
  tren!: number;
}
