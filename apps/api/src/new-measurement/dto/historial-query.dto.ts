import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// GET /new-measurement/historial?limit= — feed global (todos los trenes) de
// eventos de ciclo de vida de fichas de medición (ver NewMeasurementHistoryService).
export class HistorialQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
