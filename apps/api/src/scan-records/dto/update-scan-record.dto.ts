import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

// Edición de un ScanRecord YA confirmado (post-commit). Todos los campos son
// opcionales. A propósito NO se aceptan los campos de identidad del disco
// (coche/bogie/eje/ubicación): cambiarlos desincronizaría disc_id, que ya
// quedó resuelto en el commit. rd_value/estado_calculado tampoco se aceptan:
// el backend los recalcula a partir de H/T (fuente única de verdad).
export class UpdateScanRecordDto {
  @IsOptional()
  @IsString()
  responsableNombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kilometraje?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tValue?: number;
}
