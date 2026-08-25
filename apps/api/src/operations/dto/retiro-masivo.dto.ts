import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RetiroMasivoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  discIds!: string[];

  @IsString()
  @MaxLength(200)
  encargadoNombre!: string;

  @IsOptional()
  @IsString()
  encargadoFirma?: string;

  // Fecha del retiro — default hoy si no viaja (ver OperationsRetiroMasivoService).
  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
