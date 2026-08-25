import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const FABRICANTES = ['ansaldo_mb300', 'alstom_metropolis9000'] as const;

// Edición de campos de IDENTIDAD del eje (serie, lote, fabricante, marca) —
// aplica a los 2 discos del par a la vez. Estado/Fase/Último movimiento NO
// son editables acá (Estado se calcula de la medición, Fase/Movimiento son
// historial de las operaciones de Taller/Almacén/Operaciones). T/H de la
// medición tampoco: eso vive en Mediciones/Nuevas Mediciones, no se duplica
// acá para no divergir de esa lógica de recálculo de Rd/estado.
export class EditarEjeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lote?: string;

  @IsOptional()
  @IsIn(FABRICANTES)
  fabricante?: (typeof FABRICANTES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marcaRueda?: string;
}
