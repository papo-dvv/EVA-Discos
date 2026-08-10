import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

export const TIPOS_REFERENCIA = ['ultima_medicion', 'ultima_ficha'] as const;
export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number];

// GET /new-measurement/reference?tren=&tipo= — comparativa histórica contra
// la que se contrasta una ficha en curso (ver NewMeasurementReferenceService).
export class ReferenceQueryDto {
  @Type(() => Number)
  @IsInt()
  tren!: number;

  @IsIn(TIPOS_REFERENCIA)
  tipo!: TipoReferencia;
}
