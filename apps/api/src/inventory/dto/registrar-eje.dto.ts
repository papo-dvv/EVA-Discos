import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const FABRICANTES = ['ansaldo_mb300', 'alstom_metropolis9000'] as const;

// Alta de un EJE nuevo de stock (izquierdo + derecho juntos, comparten
// serie) — SIEMPRE entra por Almacén salvo que `autoTaller` esté marcado,
// fase SIEMPRE Nueva (ver InventoryService.registrarEje y el comentario de
// BrakeDisc.fase en schema.prisma: nunca 'usada' al dar de alta, sin
// importar el stage destino — 'usada' solo ocurre al pasar por en_servicio).
export class RegistrarEjeDto {
  @IsString()
  @MaxLength(100)
  serie!: string;

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

  // true = va directo a Taller (retirado automático), false/ausente = Almacén.
  @IsOptional()
  @IsBoolean()
  autoTaller?: boolean;
}
