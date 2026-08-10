import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { TipoCoche } from '../../../generated/prisma';
import { aBoolean } from '../../migration/dto/preview-query.dto';

const TIPOS_COCHE_VALORES = Object.values(TipoCoche);

// Scope genérico de trazabilidad: tren/tipoCoche/bogieCodigo son
// independientes entre sí y se combinan siempre en AND (a diferencia de los
// filtros de /wear-rate/pairs, acá no hay modoCombinacion — son dimensiones
// del alcance de los datos, no filtros de fila que el usuario alterne).
// Ninguno presente = vista general de toda la flota. Reutilizado por
// /summary y, vía herencia, por /series (ver TraceabilitySeriesQueryDto).
export class TraceabilityScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @IsOptional()
  @IsIn(TIPOS_COCHE_VALORES)
  tipoCoche?: TipoCoche;

  // Texto libre (catálogo BogieCatalog, no un enum cerrado) — mismo criterio
  // que bogieCodigo en wear-rate-pairs-query.dto.ts.
  @IsOptional()
  @IsString()
  bogieCodigo?: string;

  // Filtra el conjunto de wear_rate_pairs usado para TODOS los cálculos
  // (límites, consenso, estadísticas generales, asimetría, series del
  // gráfico) al rango de km de Proyección (proyeccion_km_rango_min/max, ver
  // ProyeccionConfigService — el MISMO rango, reutilizado tal cual, nunca
  // duplicado). Default true a nivel DTO (ausente en la query -> true acá vía
  // el Transform); el ausente de un objeto plano armado a mano (tests
  // unitarios que llaman al servicio directo, sin pasar por este DTO) NO
  // dispara este default — ver TraceabilityService, que solo filtra cuando
  // el valor es exactamente `true`. NUNCA afecta promedioRangoKm (rango fijo
  // propio de Trazabilidad) ni el cálculo interno de ProyeccionRateService.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value) ?? true)
  @IsBoolean()
  filtrarPorRangoKm: boolean = true;
}
