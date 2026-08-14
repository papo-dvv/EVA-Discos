import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

// Rango de pronóstico soportado por GET /projection/pronostico — la
// agregación siempre es MENSUAL, `meses` solo controla cuántas filas trae la
// respuesta. Lista exacta y cerrada (no cualquier entero): rechaza cualquier
// otro valor con 400 en vez de aceptar rangos arbitrarios sin sentido de
// negocio (ej. 13, 100).
export const RANGOS_PRONOSTICO_MESES = [12, 24, 36, 48, 60, 77] as const;
export type RangoPronosticoMeses = (typeof RANGOS_PRONOSTICO_MESES)[number];

export class ProyeccionPronosticoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  // Default 12: mismo comportamiento que el viejo /pronostico-12-meses
  // cuando no se especifica rango.
  @IsOptional()
  @Type(() => Number)
  @IsIn(RANGOS_PRONOSTICO_MESES)
  meses: RangoPronosticoMeses = 12;
}
