import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { aArray } from '../../migration/dto/preview-query.dto';
import type { TipoEventoHistorial } from '../historial.service';

const TIPOS_EVENTO_HISTORIAL: TipoEventoHistorial[] = [
  'CAMBIO_DISCO',
  'MEDICION',
  'REPERFILADO',
];

export class HistorialQueryDto {
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsIn(TIPOS_EVENTO_HISTORIAL, { each: true })
  tipo?: TipoEventoHistorial[];

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
