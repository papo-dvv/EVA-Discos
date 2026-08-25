import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Alta de una pieza nueva de stock en Almacén — no pedida explícitamente en
// el enunciado original, pero indispensable: sin esto Almacén queda vacío
// para siempre y Retiro Masivo/Cambio de Disco no tendrían de dónde partir
// (ver plan de Inventario/Operaciones). stage/fase se fijan siempre a
// almacen/nueva en el servicio, no viajan en el DTO.
export class RegistrarDiscoDto {
  @IsString()
  @MaxLength(100)
  serie!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marcaRueda?: string;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;
}
