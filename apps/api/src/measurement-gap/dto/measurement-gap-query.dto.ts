import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class MeasurementGapQueryDto {
  // Ausente = usa el umbral configurado en system_params (ver
  // MeasurementGapConfigService, default 6). Presente = override puntual para
  // este request únicamente (no persiste) — útil para que el frontend
  // muestre "qué pasaría si el umbral fuera X" sin tener que guardar el
  // cambio primero.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  umbralMeses?: number;
}
