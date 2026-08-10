import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LadoDisco, type EstadoDisco } from '../../../generated/prisma';
import {
  aArray,
  ESTADOS_DISCO_CON_REPERFILADO,
} from '../../migration/dto/preview-query.dto';

const LADOS_VALORES = Object.values(LadoDisco);

// Mismo patrón de paginación que PreviewQueryDto (migration/dto/preview-query.dto.ts):
// page/pageSize con default y tope, tren opcional (ausente = vista general de
// toda la flota). Los filtros de acá abajo son TODOS campos derivados de la
// proyección (estado actual, fechas estimadas, H/T/Rd) — ninguno es una
// columna de BrakeDisc, así que el servicio los aplica DESPUÉS de proyectar
// cada disco (ver ProyeccionService.listarDiscos), no como un WHERE de Prisma.
export class ProyeccionDiscosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 25;

  // Modo de combinación de TODOS los filtros activos a la vez — mismo
  // criterio que PreviewQueryDto/WearRatePairsQueryDto.
  @IsOptional()
  @IsIn(['AND', 'OR'])
  modoCombinacion?: 'AND' | 'OR' = 'AND';

  // Estado ACTUAL del disco (el de la columna "Estado", clasificarEstadoConReperfilado
  // sobre la última medición) — incluye REPERFILADO, a diferencia de wear-rate/pairs.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsIn(ESTADOS_DISCO_CON_REPERFILADO, { each: true })
  estado?: EstadoDisco[];

  // Rango de fecha del PRIMER ciclo de reperfilado (columna "Siguiente
  // Reperfilado"). Un disco sin ciclosReperfilado (proyectable=false, o
  // proyectable=true pero el primer ciclo ya cae en cambio) nunca matchea
  // este filtro cuando está activo.
  @IsOptional()
  @IsISO8601()
  siguienteReperfiladoDesde?: string;

  @IsOptional()
  @IsISO8601()
  siguienteReperfiladoHasta?: string;

  // Rango de fecha del ciclo de cambio (columna "Siguiente Cambio"). Un disco
  // truncado (sin cicloCambio) nunca matchea este filtro cuando está activo.
  @IsOptional()
  @IsISO8601()
  siguienteCambioDesde?: string;

  @IsOptional()
  @IsISO8601()
  siguienteCambioHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rdMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rdMax?: number;

  // Los 3 filtros de abajo (eje/rueda/lado) SÍ son columnas reales de
  // BrakeDisc — a diferencia del resto de este DTO, se aplican como WHERE de
  // Prisma sobre el scope ANTES de proyectar (ver
  // ProyeccionService.resolverDiscosEnScope), no como filtro derivado.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ejeMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ruedaMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ruedaMax?: number;

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsIn(LADOS_VALORES, { each: true })
  lado?: LadoDisco[];

  // motivo/responsable SÍ son filtros derivados (ver cumpleFiltros): no son
  // columnas de BrakeDisc, salen de la ÚLTIMA MEDICIÓN confirmada del disco
  // (la misma que ancla la proyección) — mismo criterio insensible a
  // mayúsculas que motivo/responsable en PreviewQueryDto (Mediciones
  // confirmadas). vistaFecha NO aplica acá a propósito: la proyección
  // siempre parte de la medición más reciente del disco, nunca de la más
  // antigua ni del histórico completo — no hay "vista" que alternar.
  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsString({ each: true })
  motivo?: string[];

  @IsOptional()
  @Transform(({ value }) => aArray(value))
  @IsString({ each: true })
  responsable?: string[];
}
