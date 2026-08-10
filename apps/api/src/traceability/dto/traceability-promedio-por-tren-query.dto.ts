import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

// A propósito SIN filtrarPorRangoKm ni tipoCoche/bogieCodigo: este endpoint
// promedia TODO el scope del tren (o de toda la flota, si `tren` está
// ausente) sin ningún recorte de km — ver
// TraceabilityService.obtenerPromedioPorTren. El ValidationPipe global
// (whitelist:true, forbidNonWhitelisted:true, ver main.ts) rechaza con 400
// cualquier intento de mandar un parámetro que no sea `tren`.
export class TraceabilityPromedioPorTrenQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tren?: number;
}
