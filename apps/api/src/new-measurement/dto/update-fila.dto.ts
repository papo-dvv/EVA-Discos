import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LadoDisco } from '../../../generated/prisma';

const LADOS_VALORES = Object.values(LadoDisco);

// Edición inline de una fila en borrador (preview de una ficha de medición).
// Todos los campos opcionales — se envía solo lo que cambia. rd_value y
// estado_calculado NUNCA se aceptan del cliente: el backend siempre los
// recalcula a partir de H/T. Si eje o lado cambian, el servicio vuelve a
// resolver tipo de coche/bogie/rueda/orden físico (ver
// NewMeasurementPreviewService.editarFila) — no se aceptan directamente para
// evitar combinaciones eje/bogie/coche inconsistentes.
export class UpdateFilaDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rugosidadRa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  ejeNumero?: number;

  @IsOptional()
  @IsIn(LADOS_VALORES)
  lado?: LadoDisco;

  @IsOptional()
  @IsString()
  observacion?: string;
}
