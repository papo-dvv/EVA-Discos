import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// El "eje" a cambiar se identifica por numeroCoche (WagonUnit.numeroCoche,
// único en toda la flota) + bogieCodigo + ejeNumero — misma identidad física
// que BrakeDisc. Los 2 lados (izquierdo/derecho) de ese eje se reemplazan
// SIEMPRE juntos, así que cada asignación no lleva "lado": ambos discos de
// reemplazo vienen indicados aparte.
export class AsignacionEjeDto {
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
}

// Cambio de disco de 1 a 4 ejes de UN mismo coche en una sola operación
// (confirmado con el usuario: no obliga a reemplazar los 4 a la vez, a
// diferencia de "Cambio de Par Montado" de EVA-Aldy). Las validaciones de
// "no repetir el mismo eje" / "no reusar un disco de reemplazo entre
// asignaciones" viven en el servicio, no acá (mismo criterio que el resto
// del módulo: los checks cruzados contra la BD/entre filas se hacen en el
// service layer, no con decoradores).
export class CambioDiscoDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  numeroCoche!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => AsignacionEjeDto)
  asignaciones!: AsignacionEjeDto[];

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
