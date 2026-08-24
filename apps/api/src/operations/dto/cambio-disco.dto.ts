import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// El "eje" a cambiar se identifica por numeroCoche (WagonUnit.numeroCoche,
// único en toda la flota) + bogieCodigo + ejeNumero — misma identidad física
// que BrakeDisc. Los 2 lados (izquierdo/derecho) de ese eje se reemplazan
// SIEMPRE juntos en una sola operación (confirmado con el usuario), así que
// el DTO no lleva "lado": ambos discos de reemplazo vienen indicados aparte.
export class CambioDiscoDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  numeroCoche!: number;

  @IsString()
  @MaxLength(10)
  bogieCodigo!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  ejeNumero!: number;

  @IsUUID()
  discoNuevoIzquierdoId!: string;

  @IsUUID()
  discoNuevoDerechoId!: string;

  @IsString()
  @MaxLength(200)
  tecnicoNombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supervisorNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroPt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificacion?: string;

  @IsOptional()
  @IsString()
  firma?: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
