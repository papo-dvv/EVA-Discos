import { IsString } from 'class-validator';

// El body solo trae el valor como texto; la validación por tipo (numérico vs.
// enum) según la clave vive en system-params.config.ts, porque depende de qué
// parámetro se está editando.
export class UpdateSystemParamDto {
  @IsString()
  valor!: string;
}
