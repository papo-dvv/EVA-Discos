import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class ProyeccionPronosticoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;
}
