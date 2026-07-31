import { IsIn, IsOptional } from 'class-validator';
import { TraceabilityScopeQueryDto } from './traceability-scope-query.dto';

export const PERIODOS = ['3m', '6m', '12m', '2a', 'todo'] as const;
export type Periodo = (typeof PERIODOS)[number];

export const AGREGACIONES = ['auto', 'crudo', 'mensual'] as const;
export type Agregacion = (typeof AGREGACIONES)[number];

export class TraceabilitySeriesQueryDto extends TraceabilityScopeQueryDto {
  // El histórico COMPLETO del scope siempre se usa para calcular límites y
  // consenso (ver TraceabilityService.obtenerSeries) — este parámetro solo
  // recorta qué tramo de fechas se incluye en la respuesta, para no
  // recalcular estadísticas constantemente al navegar el periodo visible.
  @IsOptional()
  @IsIn(PERIODOS)
  periodo: Periodo = 'todo';

  // 'auto' (default): el backend decide crudo vs. mensual según el volumen
  // del tramo pedido (ver TraceabilityService.resolverAgregacion). 'crudo' y
  // 'mensual' fuerzan el modo sin importar el conteo. La agregación SOLO
  // cambia cómo se presentan los puntos — nunca los límites/consenso, que
  // siguen viniendo del histórico completo sin agregar.
  @IsOptional()
  @IsIn(AGREGACIONES)
  agregacion: Agregacion = 'auto';
}
