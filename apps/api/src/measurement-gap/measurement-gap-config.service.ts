import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Clave exacta de system_params.clave (ver prisma/seed.ts) — mismo criterio
// que CLAVES_UMBRALES (brake-disc-rules/umbrales.ts) y
// CLAVE_KM_RANGO_MIN/MAX (projection/proyeccion-config.service.ts).
export const CLAVE_UMBRAL_MESES = 'measurement_gap_umbral_meses';
const UMBRAL_MESES_POR_DEFECTO = 6;

// Resuelve measurement_gap_umbral_meses desde system_params, con fallback si
// la fila todavía no existe o su valor no es numérico — mismo patrón que
// ProyeccionConfigService/UmbralesProviderService. El umbral SEVERO (7 meses)
// NO vive acá: es un valor fijo en MeasurementGapService, nunca configurable.
@Injectable()
export class MeasurementGapConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerUmbralMeses(): Promise<number> {
    const fila = await this.prisma.systemParam.findUnique({
      where: { clave: CLAVE_UMBRAL_MESES },
    });
    if (!fila) return UMBRAL_MESES_POR_DEFECTO;

    const numero = Number(fila.valor);
    return Number.isFinite(numero) ? numero : UMBRAL_MESES_POR_DEFECTO;
  }
}
