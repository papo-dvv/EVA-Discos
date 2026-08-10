import { IsIn } from 'class-validator';

// Únicos 2 campos soportados por ahora (ver GET /scan-records/valores-distintos
// y GET /migration/:fileId/valores-distintos) — ninguno es un enum, así que no
// hay una lista fija de OPCIONES posible en el backend, solo de CAMPOS.
export const CAMPOS_VALORES_DISTINTOS = ['motivo', 'responsable'] as const;
export type CampoValoresDistintos = (typeof CAMPOS_VALORES_DISTINTOS)[number];

export class ValoresDistintosQueryDto {
  @IsIn(CAMPOS_VALORES_DISTINTOS)
  campo!: CampoValoresDistintos;
}
