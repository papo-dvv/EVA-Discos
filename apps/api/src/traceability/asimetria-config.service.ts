import { Injectable } from '@nestjs/common';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';

// Clave exacta de system_params.clave — mismo criterio que CLAVES_PERCENTILES
// en consenso-config.service.ts. Único parámetro configurable del cálculo de
// asimetría (ver clasificarAsimetria en traceability-stats.service.ts):
// cambiarlo NO dispara la validación de consenso (Reglas A/B), no afecta
// gauss/percentiles/tukey.
export const CLAVE_UMBRAL_SIMETRICA = 'asimetria_umbral_simetrica';

const UMBRAL_SIMETRICA_POR_DEFECTO = 0.5;

// Resuelve asimetria_umbral_simetrica desde system_params, con fallback si la
// fila todavía no existe o su valor no es numérico — mismo patrón que
// ConsensoConfigService.obtenerEpsilon.
@Injectable()
export class AsimetriaConfigService {
  constructor(private readonly systemParamsCache: SystemParamsCacheService) {}

  async obtenerUmbralSimetrica(): Promise<number> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();
    const texto = valoresPorClave.get(CLAVE_UMBRAL_SIMETRICA);
    const valor = texto !== undefined ? Number(texto) : NaN;
    return Number.isFinite(valor) ? valor : UMBRAL_SIMETRICA_POR_DEFECTO;
  }
}
