import { Injectable } from '@nestjs/common';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';
import type { FraccionesPercentil } from './traceability-stats.service';

// Claves exactas de system_params.clave — mismo criterio que
// CLAVES_UMBRALES en brake-disc-rules/umbrales.ts.
export const CLAVES_PERCENTILES = {
  limiteInferior: 'percentil_limite_inferior',
  limiteSuperior: 'percentil_limite_superior',
  extremoInferior: 'percentil_extremo_inferior',
  extremoSuperior: 'percentil_extremo_superior',
} as const satisfies Record<keyof FraccionesPercentil, string>;

export const CLAVE_EPSILON = 'consenso_extremo_epsilon';

// Amplitud máxima permitida del EXTREMO de consenso (superior - inferior) —
// misma idea que AMPLITUD_MAXIMA_LIMITE (fija, 0.25) en consenso-validation.service.ts,
// pero configurable y opcional: NULL/ausente = sin restricción activa (el
// extremo nunca se rechazaba por amplitud antes de esto). Se guarda como fila
// de system_params con valor '' (string vacío) para representar "sin
// restricción" dentro de una columna `valor` que no admite NULL real.
export const CLAVE_AMPLITUD_MAXIMA_EXTREMO = 'amplitud_maxima_extremo';

// Defaults en escala "humana" de percentil (0-100, ej. P25 = 25) — se
// dividen entre 100 recién al resolver, así ConsensoConfigService siempre
// entrega fracciones 0..1 (lo que espera calcularLimitesPercentiles).
const PERCENTILES_POR_DEFECTO_0_100: Record<keyof FraccionesPercentil, number> =
  {
    limiteInferior: 25,
    limiteSuperior: 75,
    extremoInferior: 10,
    extremoSuperior: 90,
  };

const EPSILON_POR_DEFECTO = 0.001;

// true si `clave` es uno de los 4 parámetros de percentil configurables —
// usado por SystemParamsService para decidir si un PATCH dispara la
// validación de consenso (ver ConsensoValidationService). consenso_extremo_epsilon
// NO cuenta: cambiarlo no afecta gauss/percentiles/tukey/consenso, solo a qué
// valor se ajusta un extremo ya detectado <= 0 (Regla B).
export function esClavePercentil(clave: string): boolean {
  return campoDeClave(clave) !== null;
}

function campoDeClave(clave: string): keyof FraccionesPercentil | null {
  const entrada = (
    Object.entries(CLAVES_PERCENTILES) as [keyof FraccionesPercentil, string][]
  ).find(([, valorClave]) => valorClave === clave);
  return entrada ? entrada[0] : null;
}

// Resuelve los parámetros configurables del consenso (las 4 fracciones de
// percentil + el epsilon de piso del extremo inferior) desde system_params,
// con fallback si la fila todavía no existe o su valor no es numérico —
// mismo patrón que UmbralesProviderService (BrakeDiscRulesModule): nunca
// revienta por un parámetro no configurado todavía.
@Injectable()
export class ConsensoConfigService {
  constructor(private readonly systemParamsCache: SystemParamsCacheService) {}

  async obtenerFracciones(): Promise<FraccionesPercentil> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();

    return {
      limiteInferior: this.leerFraccion(valoresPorClave, 'limiteInferior'),
      limiteSuperior: this.leerFraccion(valoresPorClave, 'limiteSuperior'),
      extremoInferior: this.leerFraccion(valoresPorClave, 'extremoInferior'),
      extremoSuperior: this.leerFraccion(valoresPorClave, 'extremoSuperior'),
    };
  }

  async obtenerEpsilon(): Promise<number> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();
    const texto = valoresPorClave.get(CLAVE_EPSILON);
    const valor = texto !== undefined ? Number(texto) : NaN;
    return Number.isFinite(valor) ? valor : EPSILON_POR_DEFECTO;
  }

  // null = sin restricción activa (fila ausente, vacía, o con un valor no
  // numérico) — a diferencia de los demás parámetros de este servicio, acá
  // "no configurado" NO cae a un número por defecto: la Regla A del extremo
  // (ver ConsensoValidationService) simplemente no se evalúa.
  async obtenerAmplitudMaximaExtremo(): Promise<number | null> {
    const valoresPorClave = await this.systemParamsCache.obtenerTodos();
    const crudo = valoresPorClave.get(CLAVE_AMPLITUD_MAXIMA_EXTREMO);
    if (crudo === undefined) return null;
    const texto = crudo.trim();
    if (texto === '') return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }

  // Las fracciones VIGENTES, pero con la clave que se está editando
  // reemplazada por el valor candidato (todavía no persistido) — para poder
  // simular "qué consenso resultaría" ANTES de guardar (ver
  // ConsensoValidationService y SystemParamsService.actualizar). Si `clave`
  // no es un parámetro de percentil, devuelve las fracciones vigentes tal
  // cual (nunca debería llamarse así, pero es un fallback seguro).
  async obtenerFraccionesConCandidato(
    clave: string,
    valorNuevoTexto: string,
  ): Promise<FraccionesPercentil> {
    const actuales = await this.obtenerFracciones();
    const campo = campoDeClave(clave);
    if (!campo) return actuales;
    return { ...actuales, [campo]: Number(valorNuevoTexto) / 100 };
  }

  private leerFraccion(
    valoresPorClave: Map<string, string>,
    campo: keyof FraccionesPercentil,
  ): number {
    const valor = valoresPorClave.get(CLAVES_PERCENTILES[campo]);
    const numero = valor !== undefined ? Number(valor) : NaN;
    const percentil0a100 = Number.isFinite(numero)
      ? numero
      : PERCENTILES_POR_DEFECTO_0_100[campo];
    return percentil0a100 / 100;
  }
}
