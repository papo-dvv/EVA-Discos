import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';

export const TIPOS_EVENTO_PRONOSTICO = ['REPERFILADO', 'CAMBIO'] as const;
export type TipoEventoPronostico = (typeof TIPOS_EVENTO_PRONOSTICO)[number];

// `periodo` acepta un mes (YYYY-MM) o un año completo (YYYY). El frontend
// solo genera períodos dentro del horizonte visible, pero el formato cerrado
// evita consultas ambiguas o rangos abiertos en el endpoint de detalle.
export class ProyeccionPronosticoDetalleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;

  @Matches(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/)
  periodo!: string;

  @IsOptional()
  @IsIn(TIPOS_EVENTO_PRONOSTICO)
  tipo?: TipoEventoPronostico;
}
