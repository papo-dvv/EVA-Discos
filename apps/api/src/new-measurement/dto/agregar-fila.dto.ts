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

// Agrega UNA fila de medición a una ficha en borrador — usado por el modo
// manual para ir completando, de a un disco, el esqueleto de 48 posiciones
// (ver CrearManualDto). También sirve para agregar un disco que el CSV no
// trajo (carga parcial) sin tener que reprocesar el archivo entero.
export class AgregarFilaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  ejeNumero!: number;

  @IsIn(LADOS_VALORES)
  lado!: LadoDisco;

  @Type(() => Number)
  @IsNumber()
  hValue!: number;

  @Type(() => Number)
  @IsNumber()
  tValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reperfiladoTAntes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reperfiladoHAntes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rugosidadRa?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
