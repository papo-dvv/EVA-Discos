import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MOTIVOS_RECONOCIDOS,
  type MotivoFicha,
} from '../new-measurement-csv.parser';

// GET /new-measurement/historial?limit= — feed global (todos los trenes) de
// eventos de ciclo de vida de fichas de medición (ver NewMeasurementHistoryService).
export class HistorialQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsIn(MOTIVOS_RECONOCIDOS)
  motivo?: MotivoFicha;
}
