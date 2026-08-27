import { Injectable } from '@nestjs/common';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';

// Claves exactas de system_params.clave — mismo criterio que CLAVES_UMBRALES
// (brake-disc-rules/umbrales.ts) y CLAVES_PERCENTILES (traceability/consenso-config.service.ts).
export const CLAVE_KM_RANGO_MIN = 'proyeccion_km_rango_min';
export const CLAVE_KM_RANGO_MAX = 'proyeccion_km_rango_max';

// Mismos valores que el rango fijo de Trazabilidad (KM_RANGO_INFERIOR/SUPERIOR
// en traceability.service.ts), pero acá SÍ configurables: son el rango propio
// de la tasa promedio de desgaste por tipo de coche que alimenta la
// Proyección de Reperfilado y Cambio (ver ProyeccionRateService).
const KM_RANGO_MIN_POR_DEFECTO = 7000;
const KM_RANGO_MAX_POR_DEFECTO = 15000;

export interface RangoKmProyeccion {
  kmMin: number;
  kmMax: number;
}

// Resuelve proyeccion_km_rango_min/max desde system_params, con fallback si
// la fila todavía no existe o su valor no es numérico — mismo patrón que
// UmbralesProviderService/ConsensoConfigService/AsimetriaConfigService.
@Injectable()
export class ProyeccionConfigService {
  constructor(private readonly systemParamsCache: SystemParamsCacheService) {}

  async obtenerRangoKm(): Promise<RangoKmProyeccion> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();

    return {
      kmMin: this.leerNumero(
        valoresPorClave,
        CLAVE_KM_RANGO_MIN,
        KM_RANGO_MIN_POR_DEFECTO,
      ),
      kmMax: this.leerNumero(
        valoresPorClave,
        CLAVE_KM_RANGO_MAX,
        KM_RANGO_MAX_POR_DEFECTO,
      ),
    };
  }

  private leerNumero(
    valoresPorClave: Map<string, string>,
    clave: string,
    porDefecto: number,
  ): number {
    const valor = valoresPorClave.get(clave);
    if (valor === undefined) return porDefecto;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : porDefecto;
  }
}
