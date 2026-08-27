import { Injectable } from '@nestjs/common';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';
import {
  CLAVES_UMBRALES,
  UMBRALES_POR_DEFECTO,
  type Umbrales,
} from './umbrales';

// Lee los 4 umbrales desde el caché compartido de system_params (ver
// SystemParamsCacheService) y completa con el valor por defecto lo que falte
// (fila inexistente o valor no numérico) — nunca revienta por un parámetro no
// configurado todavía.
@Injectable()
export class UmbralesProviderService {
  constructor(private readonly systemParamsCache: SystemParamsCacheService) {}

  async obtenerUmbrales(): Promise<Umbrales> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();

    return {
      rdUmbralOk: this.leerNumero(
        valoresPorClave,
        CLAVES_UMBRALES.rdUmbralOk,
        UMBRALES_POR_DEFECTO.rdUmbralOk,
      ),
      rdUmbralSeguimiento: this.leerNumero(
        valoresPorClave,
        CLAVES_UMBRALES.rdUmbralSeguimiento,
        UMBRALES_POR_DEFECTO.rdUmbralSeguimiento,
      ),
      rdUmbralCritico: this.leerNumero(
        valoresPorClave,
        CLAVES_UMBRALES.rdUmbralCritico,
        UMBRALES_POR_DEFECTO.rdUmbralCritico,
      ),
      hUmbralReperfilado: this.leerNumero(
        valoresPorClave,
        CLAVES_UMBRALES.hUmbralReperfilado,
        UMBRALES_POR_DEFECTO.hUmbralReperfilado,
      ),
      reperfiladoDescuentoRd: this.leerNumero(
        valoresPorClave,
        CLAVES_UMBRALES.reperfiladoDescuentoRd,
        UMBRALES_POR_DEFECTO.reperfiladoDescuentoRd,
      ),
    };
  }

  private leerNumero(
    valoresPorClave: Map<string, string>,
    clave: string,
    valorPorDefecto: number,
  ): number {
    const valor = valoresPorClave.get(clave);
    if (valor === undefined) return valorPorDefecto;

    const parseado = Number(valor);
    return Number.isFinite(parseado) ? parseado : valorPorDefecto;
  }
}
