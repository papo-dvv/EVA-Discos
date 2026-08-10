import {
  aplicarPisoExtremoInferior,
  calcularAsimetria,
  calcularConsenso,
  calcularEstadisticasGenerales,
  calcularLimitesGauss,
  calcularLimitesPercentiles,
  calcularLimitesTukey,
  clasificarAsimetria,
  clasificarYLimpiarSerie,
  type ConsensoLimites,
  type LimitesMetodo,
} from './traceability-stats.service';

// Dataset sintético 1..20: aritmética simple, simétrica alrededor de 10.5,
// que permite calcular a mano media/desviación/percentiles/cuartiles sin
// ambigüedad. Se reutiliza en varios describe de este archivo.
const VALORES_1_A_20 = Array.from({ length: 20 }, (_, i) => i + 1);

describe('calcularLimitesGauss', () => {
  it('media ± 2σ (límite) y media ± 3σ (extremo), con σ muestral (n-1)', () => {
    // media = (1+20)/2 = 10.5. Suma de cuadrados de las desviaciones para
    // 1..20 = n(n²-1)/12 = 20·399/12 = 665 -> varianza muestral = 665/19 = 35
    // (exacto) -> σ = √35.
    const media = 10.5;
    const desviacion = Math.sqrt(35);
    const resultado = calcularLimitesGauss(VALORES_1_A_20);

    expect(resultado.limiteInferior).toBeCloseTo(media - 2 * desviacion, 9);
    expect(resultado.limiteSuperior).toBeCloseTo(media + 2 * desviacion, 9);
    expect(resultado.extremoInferior).toBeCloseTo(media - 3 * desviacion, 9);
    expect(resultado.extremoSuperior).toBeCloseTo(media + 3 * desviacion, 9);
  });
});

// Fracciones por defecto de ConsensoConfigService (P20/P60/P10/P90 — ver
// consenso-config.service.ts) en escala 0..1, tal como las resuelve un
// llamador real. Este archivo testea calcularLimitesPercentiles como función
// PURA: las fracciones se pasan literales, sin pasar por Prisma/system_params.
const FRACCIONES_P20_P60_P10_P90 = {
  limiteInferior: 0.2,
  limiteSuperior: 0.6,
  extremoInferior: 0.1,
  extremoSuperior: 0.9,
};

describe('calcularLimitesPercentiles', () => {
  it('P20/P60 (límite) y P10/P90 (extremo) por interpolación lineal', () => {
    // Con 20 valores ordenados 1..20 (índices 0..19) y rango=(n-1)*p:
    // P20 -> rango=3.8  -> entre v[3]=4 y v[4]=5   -> 4 + 1·0.8 = 4.8
    // P60 -> rango=11.4 -> entre v[11]=12 y v[12]=13 -> 12 + 1·0.4 = 12.4
    // P10 -> rango=1.9  -> entre v[1]=2 y v[2]=3   -> 2 + 1·0.9 = 2.9
    // P90 -> rango=17.1 -> entre v[17]=18 y v[18]=19 -> 18 + 1·0.1 = 18.1
    const resultado = calcularLimitesPercentiles(
      VALORES_1_A_20,
      FRACCIONES_P20_P60_P10_P90,
    );

    expect(resultado.limiteInferior).toBeCloseTo(4.8, 9);
    expect(resultado.limiteSuperior).toBeCloseTo(12.4, 9);
    expect(resultado.extremoInferior).toBeCloseTo(2.9, 9);
    expect(resultado.extremoSuperior).toBeCloseTo(18.1, 9);
  });

  it('no depende del orden de entrada (ordena internamente)', () => {
    const desordenado = [...VALORES_1_A_20].reverse();
    expect(
      calcularLimitesPercentiles(desordenado, FRACCIONES_P20_P60_P10_P90),
    ).toEqual(
      calcularLimitesPercentiles(VALORES_1_A_20, FRACCIONES_P20_P60_P10_P90),
    );
  });
});

describe('calcularLimitesTukey', () => {
  it('Q1-1.5×IQR / Q3+1.5×IQR (límite) y Q1-3×IQR / Q3+3×IQR (extremo)', () => {
    // Q1 (p=0.25) -> rango=4.75 -> entre v[4]=5 y v[5]=6 -> 5 + 1·0.75 = 5.75
    // Q3 (p=0.75) -> rango=14.25 -> entre v[14]=15 y v[15]=16 -> 15 + 1·0.25 = 15.25
    // IQR = 15.25 - 5.75 = 9.5
    const resultado = calcularLimitesTukey(VALORES_1_A_20);

    expect(resultado.limiteInferior).toBeCloseTo(5.75 - 1.5 * 9.5, 9); // -8.5
    expect(resultado.limiteSuperior).toBeCloseTo(15.25 + 1.5 * 9.5, 9); // 29.5
    expect(resultado.extremoInferior).toBeCloseTo(5.75 - 3 * 9.5, 9); // -22.75
    expect(resultado.extremoSuperior).toBeCloseTo(15.25 + 3 * 9.5, 9); // 43.75
  });
});

describe('calcularConsenso', () => {
  it('ejemplo de referencia: Gauss[3,5], Percentiles[2,6], Tukey[3,6] -> consenso límite [3,5]', () => {
    const gauss: LimitesMetodo = {
      limiteInferior: 3,
      limiteSuperior: 5,
      extremoInferior: 1,
      extremoSuperior: 7,
    };
    const percentiles: LimitesMetodo = {
      limiteInferior: 2,
      limiteSuperior: 6,
      extremoInferior: 0,
      extremoSuperior: 8,
    };
    const tukey: LimitesMetodo = {
      limiteInferior: 3,
      limiteSuperior: 6,
      extremoInferior: 2,
      extremoSuperior: 7,
    };

    const resultado = calcularConsenso(gauss, percentiles, tukey);

    expect(resultado.limiteConsenso).toEqual({ inferior: 3, superior: 5 });
    // Mismo criterio (máx de los inferiores, mín de los superiores) sobre los
    // extremos: máx(1,0,2)=2, mín(7,8,7)=7.
    expect(resultado.extremoConsenso).toEqual({ inferior: 2, superior: 7 });
  });
});

describe('aplicarPisoExtremoInferior', () => {
  const consensoBase: ConsensoLimites = {
    limiteConsenso: { inferior: 3, superior: 5 },
    extremoConsenso: { inferior: 2, superior: 7 },
  };

  it('extremoConsenso.inferior > 0: devuelve el consenso sin tocarlo', () => {
    expect(aplicarPisoExtremoInferior(consensoBase, 0.001)).toEqual(
      consensoBase,
    );
  });

  it('extremoConsenso.inferior == 0: lo ajusta a epsilon', () => {
    const consenso: ConsensoLimites = {
      limiteConsenso: { inferior: 3, superior: 5 },
      extremoConsenso: { inferior: 0, superior: 7 },
    };
    expect(aplicarPisoExtremoInferior(consenso, 0.001)).toEqual({
      limiteConsenso: { inferior: 3, superior: 5 },
      extremoConsenso: { inferior: 0.001, superior: 7 },
    });
  });

  it('extremoConsenso.inferior < 0: lo ajusta a epsilon (nunca deja un extremo negativo)', () => {
    const consenso: ConsensoLimites = {
      limiteConsenso: { inferior: 3, superior: 5 },
      extremoConsenso: { inferior: -0.01, superior: 7 },
    };
    expect(aplicarPisoExtremoInferior(consenso, 0.001).extremoConsenso).toEqual(
      { inferior: 0.001, superior: 7 },
    );
  });

  it('nunca toca extremoConsenso.superior ni limiteConsenso', () => {
    const consenso: ConsensoLimites = {
      limiteConsenso: { inferior: 3, superior: 5 },
      extremoConsenso: { inferior: -5, superior: 7 },
    };
    const resultado = aplicarPisoExtremoInferior(consenso, 0.001);
    expect(resultado.extremoConsenso.superior).toBe(7);
    expect(resultado.limiteConsenso).toEqual({ inferior: 3, superior: 5 });
  });
});

describe('clasificarYLimpiarSerie', () => {
  // Consenso fijo para todo este describe, derivado del ejemplo de arriba:
  // limiteConsenso=[3,5], extremoConsenso=[2,7].
  const limiteConsenso = { inferior: 3, superior: 5 };
  const extremoConsenso = { inferior: 2, superior: 7 };
  const fecha = new Date('2026-01-01');

  it('un valor dentro de limiteConsenso -> normal, valorLimpio = el original', () => {
    const [punto] = clasificarYLimpiarSerie(
      [{ fecha, valor: 4 }],
      limiteConsenso,
      extremoConsenso,
    );
    expect(punto).toEqual({
      fecha,
      tasaMensualCruda: 4,
      estado: 'normal',
      valorLimpio: 4,
    });
  });

  it('un valor en 2 (fuera de limiteConsenso pero dentro de extremoConsenso[2,7]) -> recortado a 3', () => {
    const [punto] = clasificarYLimpiarSerie(
      [{ fecha, valor: 2 }],
      limiteConsenso,
      extremoConsenso,
    );
    expect(punto.estado).toBe('recortado');
    expect(punto.valorLimpio).toBe(3); // borde más cercano de limiteConsenso (inferior)
    expect(punto.tasaMensualCruda).toBe(2); // el crudo se conserva para el gráfico
  });

  it('el mismo valor en 2, con un extremoConsenso más angosto [2.5,7] -> excluido (queda fuera)', () => {
    const extremoAngosto = { inferior: 2.5, superior: 7 };
    const [punto] = clasificarYLimpiarSerie(
      [{ fecha, valor: 2 }],
      limiteConsenso,
      extremoAngosto,
    );
    expect(punto.estado).toBe('excluido');
    expect(punto.valorLimpio).toBeNull();
    expect(punto.tasaMensualCruda).toBe(2);
  });

  it('un valor por encima de extremoConsenso.superior -> excluido', () => {
    const [punto] = clasificarYLimpiarSerie(
      [{ fecha, valor: 8 }],
      limiteConsenso,
      extremoConsenso,
    );
    expect(punto.estado).toBe('excluido');
    expect(punto.valorLimpio).toBeNull();
  });

  it('un valor por encima de limiteConsenso pero dentro de extremoConsenso -> recortado al borde superior', () => {
    const [punto] = clasificarYLimpiarSerie(
      [{ fecha, valor: 6 }],
      limiteConsenso,
      extremoConsenso,
    );
    expect(punto.estado).toBe('recortado');
    expect(punto.valorLimpio).toBe(5);
  });
});

describe('calcularEstadisticasGenerales', () => {
  it('media, mediana, desviación, mínimo, máximo y conteo sobre 1..20', () => {
    const resultado = calcularEstadisticasGenerales(VALORES_1_A_20);

    expect(resultado.media).toBeCloseTo(10.5, 9);
    expect(resultado.mediana).toBeCloseTo(10.5, 9);
    expect(resultado.desviacionEstandar).toBeCloseTo(Math.sqrt(35), 9);
    expect(resultado.minimo).toBe(1);
    expect(resultado.maximo).toBe(20);
    expect(resultado.conteo).toBe(20);
  });

  it('moda: el valor de mayor frecuencia', () => {
    const resultado = calcularEstadisticasGenerales([4, 4, 4, 7, 7, 9, 12]);
    expect(resultado.moda).toBe(4);
  });

  it('moda con empate: se toma el valor menor entre los empatados', () => {
    const resultado = calcularEstadisticasGenerales([1, 1, 2, 2]);
    expect(resultado.moda).toBe(1);
  });

  it('moda: redondea a 4 decimales antes de agrupar — valores casi iguales cuentan como coincidencia', () => {
    // Ninguno es exactamente igual a otro, pero los 3 primeros redondean a
    // 1.0000 — sin el redondeo, cada uno tendría frecuencia 1 (como los
    // demás) y la moda degeneraría al mínimo, no al valor realmente repetido.
    const resultado = calcularEstadisticasGenerales([
      1.00001, 1.00002, 1.00004, 2.5, 3.7,
    ]);
    expect(resultado.moda).toBe(1);
  });

  it('moda: el valor reportado es el redondeado a 4 decimales, no un miembro crudo del grupo', () => {
    const resultado = calcularEstadisticasGenerales([
      0.71231, 0.71234, 0.71229, 5.5, 9.9,
    ]);
    expect(resultado.moda).toBeCloseTo(0.7123, 9);
  });
});

describe('calcularAsimetria', () => {
  it('dataset simétrico (1..20, simétrico alrededor de la media) -> coeficiente 0 (SIMETRICA)', () => {
    // Distribución perfectamente simétrica: cada desviación por debajo de la
    // media tiene su espejo exacto por encima -> Σ(xi-media)^3 = 0.
    expect(calcularAsimetria(VALORES_1_A_20)).toBeCloseTo(0, 9);
  });

  it('dataset con cola larga a la derecha -> coeficiente positivo', () => {
    // [1,2,3,4] agrupados cerca de la media, 20 muy por encima -> cola a la
    // derecha. Valor de referencia calculado aparte con la misma fórmula
    // (G1 de Fisher-Pearson ajustado, la de Excel SKEW()):
    // media=6, s=√62.5, momento3=504, factor=√20/3 -> G1≈1.5205624222635519.
    const resultado = calcularAsimetria([1, 2, 3, 4, 20]);
    expect(resultado).not.toBeNull();
    expect(resultado).toBeGreaterThan(0);
    expect(resultado).toBeCloseTo(1.5205624222635519, 9);
  });

  it('dataset con cola larga a la izquierda -> coeficiente negativo (espejo del caso anterior)', () => {
    const resultado = calcularAsimetria([1, 17, 18, 19, 20]);
    expect(resultado).not.toBeNull();
    expect(resultado).toBeLessThan(0);
    expect(resultado).toBeCloseTo(-1.5205624222635519, 9);
  });

  it('n < 3 -> null, sin lanzar error (no debería pasar dado CONTEO_MINIMO=20, pero se cubre igual)', () => {
    expect(calcularAsimetria([])).toBeNull();
    expect(calcularAsimetria([1])).toBeNull();
    expect(calcularAsimetria([1, 2])).toBeNull();
  });
});

describe('clasificarAsimetria', () => {
  it('|coeficiente| < umbral -> SIMETRICA', () => {
    expect(clasificarAsimetria(0.3, 0.5)).toBe('SIMETRICA');
    expect(clasificarAsimetria(-0.3, 0.5)).toBe('SIMETRICA');
  });

  it('coeficiente >= umbral -> SESGO_POSITIVO', () => {
    expect(clasificarAsimetria(0.5, 0.5)).toBe('SESGO_POSITIVO'); // borde inclusivo
    expect(clasificarAsimetria(1.52, 0.5)).toBe('SESGO_POSITIVO');
  });

  it('coeficiente <= -umbral -> SESGO_NEGATIVO', () => {
    expect(clasificarAsimetria(-0.5, 0.5)).toBe('SESGO_NEGATIVO'); // borde inclusivo
    expect(clasificarAsimetria(-1.52, 0.5)).toBe('SESGO_NEGATIVO');
  });

  it('cambiar el umbral configurable mueve el límite de clasificación', () => {
    const coeficiente = 1.5205624222635519; // dataset de cola derecha de arriba
    expect(clasificarAsimetria(coeficiente, 0.5)).toBe('SESGO_POSITIVO');
    // Con un umbral más alto que el coeficiente, el mismo valor pasa a
    // considerarse SIMETRICA -> el umbral es lo único que decide el corte.
    expect(clasificarAsimetria(coeficiente, 2)).toBe('SIMETRICA');
  });
});
