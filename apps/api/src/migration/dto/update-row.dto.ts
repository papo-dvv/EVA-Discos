import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

// Edición de una fila en borrador. Todos los campos son opcionales (se envía
// solo lo que cambia). rd_value y estado_calculado NO se aceptan del cliente:
// el backend siempre los recalcula a partir de H/T (fuente única de verdad).
//
// Los campos de identidad del disco aceptan null para poder vaciarlos.
export class UpdateRowDto {
  @IsOptional()
  @IsString()
  responsableNombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trenNumero?: number;

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

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  cocheExcel?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  numeroCocheExcel?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  bogieExcel?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  ejeExcel?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  ubicacionExcel?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  ruedaExcel?: number | null;
}
