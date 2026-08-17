import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { aBoolean } from '../../migration/dto/preview-query.dto';

// Ya no recibe `tren`: el endpoint siempre calcula los 39 trenes de la
// flota (T06–T44) en una sola respuesta — ver TraceabilityService.
// El ValidationPipe global (whitelist:true, forbidNonWhitelisted:true, ver
// main.ts) rechaza con 400 cualquier parámetro que no sea uno de estos 2.
export class TraceabilityPromedioPorTrenQueryDto {
  // Mismo toggle y mismo default que TraceabilityScopeQueryDto — a
  // diferencia de la versión anterior de este endpoint, AHORA SÍ filtra el
  // universo de pares al rango de km de Proyección antes de calcular.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value) ?? true)
  @IsBoolean()
  filtrarPorRangoKm: boolean = true;

  // false por defecto: la card principal (10 primeros trenes) no necesita el
  // desglose por tipoCoche — solo el modal "ver más" (39 trenes completos)
  // lo pide explícito.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value) ?? false)
  @IsBoolean()
  incluirDetalle: boolean = false;
}
