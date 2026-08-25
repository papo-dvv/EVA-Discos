import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Devolver a Almacén (Taller -> Almacén), acción manual desde Inventario —
// mismo criterio de encargado explícito que RetiroMasivoDto (Operaciones).
export class DevolverAlmacenDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  discIds!: string[];

  @IsString()
  @MaxLength(200)
  encargadoNombre!: string;
}
