import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RetiroMasivoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  discIds!: string[];

  // Columna compartida "quién hizo la operación" (misma que usan cambio_disco
  // y devolucion_almacen, leída genérico en inventory-query.ts como
  // ultimoMovimiento.encargadoNombre) — en este modal el UI la etiqueta
  // "Técnico", no se renombra el campo para no desalinear el nombre de la
  // columna con el resto de InventoryMovement.
  @IsString()
  @MaxLength(200)
  encargadoNombre!: string;

  @IsOptional()
  @IsString()
  encargadoFirma?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supervisorNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroPt?: string;

  // Texto libre "Observaciones" — reutiliza la misma columna que
  // Justificación en cambio_disco.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificacion?: string;

  // Fecha del retiro — default hoy si no viaja (ver OperationsRetiroMasivoService).
  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
