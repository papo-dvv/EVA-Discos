import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

// Alcance declarado por el usuario al subir (informativo, para el historial
// de auditoría — ver migration-history.service.ts): NO restringe qué hojas
// procesa el parser, que siempre detecta y lee todo lo que reconoce del
// archivo (ver migration-excel.parser.ts). Multipart: llega junto al file.
export class UploadMigracionDto {
  @IsOptional()
  @IsIn(['todos', 'marca', 'tren'])
  alcance?: string;

  @IsOptional()
  @IsIn(['ALSTOM', 'ANSALDO'])
  marca?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trenNumero?: number;
}
