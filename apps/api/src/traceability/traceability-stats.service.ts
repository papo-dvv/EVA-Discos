import { Injectable } from '@nestjs/common';

// Motor de estadística de trazabilidad — puro (sin Prisma), para poder
// testearlo en aislamiento. Gauss y Tukey son convenciones estándar de
// detección de outliers con constantes FIJAS (2σ/3σ, 1.5×IQR/3×IQR) — no
// configurables ni leídas de system_params (son convención estadística, no
// una regla de negocio del dominio de discos de freno). Percentiles es la
// ÚNICA excepción: sus 4 fracciones SÍ son configurables (ver
// ConsensoConfigService, que las resuelve desde system_params con fallback a
// P20/P60/P10/P90) — quien llama a calcularLimitesPercentiles siempre debe
// resolverlas primero, nunca se asume un valor acá.

export interface LimitesMetodo {
  limiteInferior: number;
  limiteSuperior: number;
  extremoInferior: number;
  extremoSuperior: number;
}

export interface RangoConsenso {
  inferior: number;
  superior: number;
}

export interface ConsensoLimites {
  limiteConsenso: RangoConsenso;
  extremoConsenso: RangoConsenso;
}

// Las 4 fracciones (0..1) que definen los percentiles de límite/extremo —
// ver ConsensoConfigService para cómo se resuelven desde system_params.
export interface FraccionesPercentil {
  limiteInferior: number;
  limiteSuperior: number;
  extremoInferior: number;
  extremoSuperior: number;
}

export type EstadoPunto = 'normal' | 'recortado' | 'excluido';

export interface PuntoConFecha {
  fecha: Date;
  valor: number;
}

export interface PuntoClasificado {
  fecha: Date;
  tasaMensualCruda: number;
  estado: EstadoPunto;
  valorLimpio: number | null;
}

export interface EstadisticasGenerales {
  media: number;
  mediana: number;
  moda: number;
  desviacionEstandar: number;
  minimo: number;
  maximo: number;
  conteo: number;
}

function media(valores: number[]): number {
  return valores.reduce((suma, v) => suma + v, 0) / valores.length;
}

// Desviación estándar MUESTRAL (n-1, corrección de Bessel): el histórico de
// wear_rate_pairs de un scope sigue creciendo con cada medición nueva — se
// trata como una muestra de un proceso en curso, no como una población
// cerrada. Es también la convención de las cartas de control de procesos
// (SPC), que es el dominio exacto de este cálculo.
function desviacionEstandar(
  valores: number[],
  m: number = media(valores),
): number {
  const sumaCuadrados = valores.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sumaCuadrados / (valores.length - 1));
}

function ordenar(valores: number[]): number[] {
  return [...valores].sort((a, b) => a - b);
}

// Percentil por interpolación lineal (método R-7, el mismo de Excel
// PERCENTILE.INC/numpy default) — el criterio más común como default en
// herramientas de análisis estadístico. `p` es una fracción 0..1.
function percentil(valoresOrdenados: number[], p: number): number {
  const n = valoresOrdenados.length;
  if (n === 1) return valoresOrdenados[0];
  const rango = (n - 1) * p;
  const bajo = Math.floor(rango);
  const alto = Math.ceil(rango);
  if (bajo === alto) return valoresOrdenados[bajo];
  const fraccion = rango - bajo;
  return (
    valoresOrdenados[bajo] +
    (valoresOrdenados[alto] - valoresOrdenados[bajo]) * fraccion
  );
}

export function calcularLimitesGauss(valores: number[]): LimitesMetodo {
  const m = media(valores);
  const d = desviacionEstandar(valores, m);
  return {
    limiteInferior: m - 2 * d,
    limiteSuperior: m + 2 * d,
    extremoInferior: m - 3 * d,
    extremoSuperior: m + 3 * d,
  };
}

export function calcularLimitesPercentiles(
  valores: number[],
  fracciones: FraccionesPercentil,
): LimitesMetodo {
  const ordenados = ordenar(valores);
  return {
    limiteInferior: percentil(ordenados, fracciones.limiteInferior),
    limiteSuperior: percentil(ordenados, fracciones.limiteSuperior),
    extremoInferior: percentil(ordenados, fracciones.extremoInferior),
    extremoSuperior: percentil(ordenados, fracciones.extremoSuperior),
  };
}

export function calcularLimitesTukey(valores: number[]): LimitesMetodo {
  const ordenados = ordenar(valores);
  const q1 = percentil(ordenados, 0.25);
  const q3 = percentil(ordenados, 0.75);
  const iqr = q3 - q1;
  return {
    limiteInferior: q1 - 1.5 * iqr,
    limiteSuperior: q3 + 1.5 * iqr,
    extremoInferior: q1 - 3 * iqr,
    extremoSuperior: q3 + 3 * iqr,
  };
}

// El consenso es la intersección de los 3 rangos: el límite/extremo más
// conservador de cada lado gana (máximo de los inferiores, mínimo de los
// superiores) — así un punto solo se considera atípico si los 3 métodos
// coinciden en que lo es.
export function calcularConsenso(
  gauss: LimitesMetodo,
  percentiles: LimitesMetodo,
  tukey: LimitesMetodo,
): ConsensoLimites {
  return {
    limiteConsenso: {
      inferior: Math.max(
        gauss.limiteInferior,
        percentiles.limiteInferior,
        tukey.limiteInferior,
      ),
      superior: Math.min(
        gauss.limiteSuperior,
        percentiles.limiteSuperior,
        tukey.limiteSuperior,
      ),
    },
    extremoConsenso: {
      inferior: Math.max(
        gauss.extremoInferior,
        percentiles.extremoInferior,
        tukey.extremoInferior,
      ),
      superior: Math.min(
        gauss.extremoSuperior,
        percentiles.extremoSuperior,
        tukey.extremoSuperior,
      ),
    },
  };
}

// Regla de negocio (NO es parte de la convención estadística de arriba): el
// extremo inferior de consenso nunca puede ser <= 0 — un umbral "extremo" de
// desgaste negativo o cero no tiene sentido físico (ver ConsensoValidationService,
// Regla B). Se aplica DESPUÉS del consenso puro (intersección de los 3
// métodos), nunca antes: así calcularConsenso queda intacto y testeable
// aparte, y esto es una corrección explícita y por separado.
export function aplicarPisoExtremoInferior(
  consenso: ConsensoLimites,
  epsilon: number,
): ConsensoLimites {
  if (consenso.extremoConsenso.inferior > 0) return consenso;
  return {
    ...consenso,
    extremoConsenso: { ...consenso.extremoConsenso, inferior: epsilon },
  };
}

export function clasificarYLimpiarSerie(
  puntos: PuntoConFecha[],
  limiteConsenso: RangoConsenso,
  extremoConsenso: RangoConsenso,
): PuntoClasificado[] {
  return puntos.map(({ fecha, valor }) => {
    if (valor >= limiteConsenso.inferior && valor <= limiteConsenso.superior) {
      return {
        fecha,
        tasaMensualCruda: valor,
        estado: 'normal' as const,
        valorLimpio: valor,
      };
    }
    if (
      valor >= extremoConsenso.inferior &&
      valor <= extremoConsenso.superior
    ) {
      const borde =
        valor < limiteConsenso.inferior
          ? limiteConsenso.inferior
          : limiteConsenso.superior;
      return {
        fecha,
        tasaMensualCruda: valor,
        estado: 'recortado' as const,
        valorLimpio: borde,
      };
    }
    return {
      fecha,
      tasaMensualCruda: valor,
      estado: 'excluido' as const,
      valorLimpio: null,
    };
  });
}

const DECIMALES_MODA = 4;

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function calcularEstadisticasGenerales(
  valores: number[],
): EstadisticasGenerales {
  const ordenados = ordenar(valores);
  const m = media(valores);

  // Redondeado a 4 decimales ANTES de agrupar: son datos continuos (Rd en
  // mm), coincidencias con precisión completa casi nunca ocurren — sin este
  // redondeo, prácticamente cada valor es "único" y la moda siempre da el
  // mínimo (frecuencia 1 para todos).
  const frecuencias = new Map<number, number>();
  for (const v of valores) {
    const clave = redondear(v, DECIMALES_MODA);
    frecuencias.set(clave, (frecuencias.get(clave) ?? 0) + 1);
  }
  const maxFrecuencia = Math.max(...frecuencias.values());
  // Empate en la frecuencia máxima -> se toma el menor valor, para que la
  // moda sea determinística. Arranca en Infinity (no en ordenados[0]): tras
  // redondear, el mínimo crudo ya no es necesariamente una clave real del
  // mapa, así que no sirve como semilla de la comparación.
  let moda = Infinity;
  for (const [valor, frecuencia] of frecuencias) {
    if (frecuencia === maxFrecuencia && valor < moda) moda = valor;
  }

  return {
    media: m,
    mediana: percentil(ordenados, 0.5),
    moda,
    desviacionEstandar: desviacionEstandar(valores, m),
    minimo: ordenados[0],
    maximo: ordenados[ordenados.length - 1],
    conteo: valores.length,
  };
}

@Injectable()
export class TraceabilityStatsService {
  calcularLimitesGauss(valores: number[]): LimitesMetodo {
    return calcularLimitesGauss(valores);
  }

  calcularLimitesPercentiles(
    valores: number[],
    fracciones: FraccionesPercentil,
  ): LimitesMetodo {
    return calcularLimitesPercentiles(valores, fracciones);
  }

  calcularLimitesTukey(valores: number[]): LimitesMetodo {
    return calcularLimitesTukey(valores);
  }

  calcularConsenso(
    gauss: LimitesMetodo,
    percentiles: LimitesMetodo,
    tukey: LimitesMetodo,
  ): ConsensoLimites {
    return calcularConsenso(gauss, percentiles, tukey);
  }

  aplicarPisoExtremoInferior(
    consenso: ConsensoLimites,
    epsilon: number,
  ): ConsensoLimites {
    return aplicarPisoExtremoInferior(consenso, epsilon);
  }

  clasificarYLimpiarSerie(
    puntos: PuntoConFecha[],
    limiteConsenso: RangoConsenso,
    extremoConsenso: RangoConsenso,
  ): PuntoClasificado[] {
    return clasificarYLimpiarSerie(puntos, limiteConsenso, extremoConsenso);
  }

  calcularEstadisticasGenerales(valores: number[]): EstadisticasGenerales {
    return calcularEstadisticasGenerales(valores);
  }
}
