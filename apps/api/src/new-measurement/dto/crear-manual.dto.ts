import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
} from 'class-validator';
import {
  MOTIVOS_RECONOCIDOS,
  type MotivoFicha,
} from '../new-measurement-csv.parser';

// Crea una ficha en borrador 100% manual (sin CSV) para un Tren dado. Las 48
// filas de disco NO se insertan en scan_records (H/T son NOT NULL en el
// schema — no existe un "vacío" persistible); el servicio devuelve el
// esqueleto de 48 posiciones calculado en memoria para que el frontend
// renderice las filas vacías, y cada una se completa vía
// POST /new-measurement/:fichaId/records.
export class CrearManualDto {
  @Type(() => Number)
  @IsInt()
  trenNumero!: number;

  @Type(() => Number)
  @IsNumber()
  kilometraje!: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsIn(MOTIVOS_RECONOCIDOS)
  motivo?: MotivoFicha;
}
