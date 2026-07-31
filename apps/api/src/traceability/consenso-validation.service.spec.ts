import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConsensoConfigService } from './consenso-config.service';
import { ConsensoValidationService } from './consenso-validation.service';
import type { LimitesMetodo } from './traceability-stats.service';
import { TraceabilityStatsService } from './traceability-stats.service';

interface FilaPar {
  trenNumero: number;
  tipoCoche: string;
  bogieCodigo: string;
  tasaMensual: number;
}

// Nunca es la restricción vinculante en el consenso (max de inferiores / min
// de superiores) — así calcularConsenso (real, ver mock más abajo) queda
// determinado ENTERAMENTE por lo que devuelva calcularLimitesPercentiles,
// que a su vez se controla por completo desde el test vía el "marcador"
// (primer valor de cada grupo). Gauss/Tukey fijos nunca deberían ganarle a
// un percentil deliberadamente ancho o angosto en este archivo.
const NEUTRO: LimitesMetodo = {
  limiteInferior: -Infinity,
  limiteSuperior: Infinity,
  extremoInferior: -Infinity,
  extremoSuperior: Infinity,
};

// 20 filas de un tren+coche+bogie, todas con el mismo `marcador` como primer
// valor de tasaMensual (el resto son de relleno, nunca se leen: el mock de
// calcularLimitesPercentiles solo mira valores[0]).
function veinteFilas(
  tren: number,
  marcador: number,
  tipoCoche = 'MA1',
  bogieCodigo = 'PB3',
): FilaPar[] {
  return Array.from({ length: 20 }, (_, i) => ({
    trenNumero: tren,
    tipoCoche,
    bogieCodigo,
    tasaMensual: i === 0 ? marcador : marcador + i,
  }));
}

function crearServicio(
  filas: FilaPar[],
  resultadosPorMarcador: Record<number, LimitesMetodo>,
  amplitudMaximaExtremo: number | null = null,
) {
  const prisma = {
    wearRatePair: {
      findMany: jest
        .fn()
        .mockResolvedValue(filas.map((f) => ({ ...f, esValido: true }))),
    },
  };
  const statsMock = {
    calcularLimitesGauss: jest.fn().mockReturnValue(NEUTRO),
    calcularLimitesTukey: jest.fn().mockReturnValue(NEUTRO),
    calcularLimitesPercentiles: jest.fn((valores: number[]) => {
      const resultado = resultadosPorMarcador[valores[0]];
      if (!resultado) {
        throw new Error(
          `Sin resultado mockeado para el marcador ${valores[0]}`,
        );
      }
      return resultado;
    }),
    calcularConsenso: jest.fn(
      (
        gauss: LimitesMetodo,
        percentiles: LimitesMetodo,
        tukey: LimitesMetodo,
      ) => ({
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
      }),
    ),
  };
  const consensoConfigMock = {
    obtenerFraccionesConCandidato: jest.fn().mockResolvedValue({
      limiteInferior: 0.2,
      limiteSuperior: 0.6,
      extremoInferior: 0.1,
      extremoSuperior: 0.9,
    }),
    obtenerEpsilon: jest.fn().mockResolvedValue(0.001),
    obtenerAmplitudMaximaExtremo: jest
      .fn()
      .mockResolvedValue(amplitudMaximaExtremo),
  };

  return { prisma, statsMock, consensoConfigMock };
}

async function construirServicioNest(
  prisma: unknown,
  statsMock: unknown,
  consensoConfigMock: unknown,
): Promise<ConsensoValidationService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ConsensoValidationService,
      { provide: PrismaService, useValue: prisma },
      { provide: TraceabilityStatsService, useValue: statsMock },
      { provide: ConsensoConfigService, useValue: consensoConfigMock },
    ],
  }).compile();
  return moduleRef.get(ConsensoValidationService);
}

describe('ConsensoValidationService.validarCambioPercentil', () => {
  // marcador=100 -> consenso "sano": amplitud del límite 0.1 (<=0.25),
  // extremo inferior positivo. Se usa como el tren "de control" en varios
  // tests para confirmar que NUNCA aparece en combinaciones/ajustes.
  const SANO: LimitesMetodo = {
    limiteInferior: 0,
    limiteSuperior: 0.1,
    extremoInferior: 0.01,
    extremoSuperior: 0.5,
  };
  // marcador=200 -> viola Regla A: amplitud del límite = 0.3 > 0.25.
  const AMPLITUD_EXCEDIDA: LimitesMetodo = {
    limiteInferior: 0,
    limiteSuperior: 0.3,
    extremoInferior: 0.01,
    extremoSuperior: 0.5,
  };
  // marcador=300 -> viola Regla B: extremo inferior = -0.01 <= 0, pero la
  // amplitud del límite (0.1) es sana.
  const EXTREMO_EN_CERO: LimitesMetodo = {
    limiteInferior: 0,
    limiteSuperior: 0.1,
    extremoInferior: -0.01,
    extremoSuperior: 0.5,
  };
  // Igual que SANO, pero con el extremo más angosto (amplitud 0.1): SANO
  // tiene amplitud de extremo 0.49 (0.5 - 0.01), que violaría cualquier
  // amplitud_maxima_extremo <= 0.49 — no sirve como tren "de control" en los
  // tests de la Regla A extendida al extremo, que usan un tope de 0.3.
  const SANO_EXTREMO_ESTRECHO: LimitesMetodo = {
    limiteInferior: 0,
    limiteSuperior: 0.1,
    extremoInferior: 0.1,
    extremoSuperior: 0.2,
  };

  it('sin ninguna combinación con >=20 pares válidos -> aceptado sin ajustes (nada que evaluar)', async () => {
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      Array.from({ length: 5 }, (_, i) => ({
        trenNumero: 1,
        tipoCoche: 'MA1',
        bogieCodigo: 'PB3',
        tasaMensual: 100 + i,
      })),
      {},
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '25',
    );

    expect(resultado).toEqual({ tipo: 'aceptado', ajustes: [] });
    expect(statsMock.calcularLimitesPercentiles).not.toHaveBeenCalled();
  });

  it('todas las combinaciones sanas -> aceptado sin ajustes', async () => {
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      veinteFilas(1, 100),
      { 100: SANO },
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '25',
    );

    expect(resultado).toEqual({ tipo: 'aceptado', ajustes: [] });
  });

  it('Regla A: rechaza con las 4 variantes de scope que contienen al tren violador (tren solo, +tipoCoche, +bogie, +ambos)', async () => {
    const filas = [...veinteFilas(1, 100), ...veinteFilas(2, 200)];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(filas, {
      100: SANO,
      200: AMPLITUD_EXCEDIDA,
    });
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '5',
    );

    expect(resultado.tipo).toBe('rechazado');
    if (resultado.tipo !== 'rechazado') throw new Error('esperaba rechazado');

    const scopes = resultado.combinaciones.map((c) => c.scope).sort();
    expect(scopes).toEqual(
      [
        'Tren 2',
        'Tren 2 · Bogie PB3',
        'Tren 2 · MA1',
        'Tren 2 · MA1 · Bogie PB3',
      ].sort(),
    );
    expect(resultado.combinaciones.every((c) => c.amplitud === 0.3)).toBe(true);
    expect(resultado.combinaciones.every((c) => c.tipo === 'limite')).toBe(
      true,
    );
    // El tren sano (100) nunca aparece entre las violaciones.
    expect(scopes.some((s) => s.includes('Tren 1'))).toBe(false);
  });

  it('Regla B: acepta y devuelve un ajuste por cada variante de scope del tren con extremo <= 0', async () => {
    const filas = [...veinteFilas(1, 100), ...veinteFilas(3, 300)];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(filas, {
      100: SANO,
      300: EXTREMO_EN_CERO,
    });
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_extremo_inferior',
      '5',
    );

    expect(resultado.tipo).toBe('aceptado');
    if (resultado.tipo !== 'aceptado') throw new Error('esperaba aceptado');

    const scopes = resultado.ajustes.map((a) => a.scope).sort();
    expect(scopes).toEqual(
      [
        'Tren 3',
        'Tren 3 · Bogie PB3',
        'Tren 3 · MA1',
        'Tren 3 · MA1 · Bogie PB3',
      ].sort(),
    );
    expect(
      resultado.ajustes.every(
        (a) => a.valorOriginal === -0.01 && a.epsilonAplicado === 0.001,
      ),
    ).toBe(true);
  });

  it('Regla A y B a la vez (combinaciones distintas): Regla A rechaza TODO, incluidos los ajustes de la otra combinación', async () => {
    const filas = [
      ...veinteFilas(1, 100),
      ...veinteFilas(2, 200),
      ...veinteFilas(3, 300),
    ];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(filas, {
      100: SANO,
      200: AMPLITUD_EXCEDIDA,
      300: EXTREMO_EN_CERO,
    });
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '5',
    );

    expect(resultado.tipo).toBe('rechazado');
    if (resultado.tipo !== 'rechazado') throw new Error('esperaba rechazado');
    // Solo las 4 variantes del tren 2 (Regla A) — el tren 3 (que hubiera
    // generado un ajuste de Regla B) queda descartado por completo.
    expect(resultado.combinaciones).toHaveLength(4);
    expect(
      resultado.combinaciones.every((c) => c.scope.includes('Tren 2')),
    ).toBe(true);
  });

  it('prioridad DENTRO de la misma combinación: si amplitud Y extremo violan a la vez, cuenta como Regla A (no genera ajuste)', async () => {
    const AMBAS_VIOLACIONES: LimitesMetodo = {
      limiteInferior: 0,
      limiteSuperior: 0.3, // amplitud 0.3 > 0.25 (Regla A)
      extremoInferior: -0.01, // Y extremo <= 0 (Regla B) — Regla A gana
      extremoSuperior: 0.5,
    };
    // tren 1 (sano) va PRIMERO en el array para que las agrupaciones amplias
    // (global, {tipoCoche}, {bogieCodigo}, que mezclan ambos trenes) tomen su
    // marcador — así solo las 4 variantes de scope propias del tren 2 quedan
    // aisladas con AMBAS_VIOLACIONES (mismo patrón que el test de Regla A).
    const filas = [...veinteFilas(1, 100), ...veinteFilas(2, 200)];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(filas, {
      100: SANO,
      200: AMBAS_VIOLACIONES,
    });
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '5',
    );

    expect(resultado.tipo).toBe('rechazado');
    if (resultado.tipo !== 'rechazado') throw new Error('esperaba rechazado');
    // Solo las 4 variantes de scope del tren 2: {tren},{tren+tipo},{tren+bogie},{tren+tipo+bogie}.
    expect(resultado.combinaciones).toHaveLength(4);
    expect(
      resultado.combinaciones.every((c) => c.scope.includes('Tren 2')),
    ).toBe(true);
  });

  it('amplitud_maxima_extremo=NULL (default) -> un extremo ancho NUNCA se rechaza', async () => {
    // extremo: 0.5 - (-0.2) = 0.7 de amplitud, bien ancho — pero como
    // amplitudMaximaExtremo es null (default de crearServicio), la Regla A
    // extendida ni se evalúa. limiteConsenso también sano, así que no debería
    // rechazar por Regla A "límite" tampoco.
    const EXTREMO_ANCHO_SIN_RESTRICCION: LimitesMetodo = {
      limiteInferior: 0,
      limiteSuperior: 0.1,
      extremoInferior: -0.2,
      extremoSuperior: 0.5,
    };
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      veinteFilas(1, 100),
      { 100: EXTREMO_ANCHO_SIN_RESTRICCION },
      null,
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_limite_inferior',
      '5',
    );

    // extremoInferior=-0.2 <= 0 -> SÍ genera un ajuste de Regla B (nada la
    // bloquea, ya que ninguna amplitud viola). Un solo tren en el fixture ->
    // los 8 subconjuntos de scope colapsan sobre los mismos 20 valores.
    expect(resultado.tipo).toBe('aceptado');
    if (resultado.tipo !== 'aceptado') throw new Error('esperaba aceptado');
    expect(resultado.ajustes).toHaveLength(8);
  });

  it('amplitud_maxima_extremo=0.3: rechaza un extremo con amplitud 0.35 con tipo "extremo"', async () => {
    // extremo: 0.5 - 0.15 = 0.35 > 0.3 configurado.
    const EXTREMO_AMPLIO: LimitesMetodo = {
      limiteInferior: 0,
      limiteSuperior: 0.1, // límite sano, amplitud 0.1
      extremoInferior: 0.15,
      extremoSuperior: 0.5,
    };
    const filas = [...veinteFilas(1, 100), ...veinteFilas(2, 200)];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      filas,
      { 100: SANO_EXTREMO_ESTRECHO, 200: EXTREMO_AMPLIO },
      0.3,
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_extremo_superior',
      '95',
    );

    expect(resultado.tipo).toBe('rechazado');
    if (resultado.tipo !== 'rechazado') throw new Error('esperaba rechazado');
    expect(resultado.combinaciones).toHaveLength(4);
    expect(
      resultado.combinaciones.every(
        (c) => c.tipo === 'extremo' && c.scope.includes('Tren 2'),
      ),
    ).toBe(true);
    expect(
      resultado.combinaciones.every((c) => Math.abs(c.amplitud - 0.35) < 1e-9),
    ).toBe(true);
    // El tren sano (100) nunca aparece.
    expect(
      resultado.combinaciones.some((c) => c.scope.includes('Tren 1')),
    ).toBe(false);
  });

  it('amplitud_maxima_extremo configurado: si el extremo viola pero NO el límite, igual bloquea el ajuste de Regla B de esa combinación', async () => {
    // límite sano (amplitud 0.1), pero extremo simultáneamente amplio
    // (0.35 > 0.3 configurado) Y <= 0 (dispararía Regla B si nada la
    // bloqueara). La Regla A extendida al extremo debe ganarle igual.
    const EXTREMO_AMPLIO_Y_EN_CERO: LimitesMetodo = {
      limiteInferior: 0,
      limiteSuperior: 0.1,
      extremoInferior: -0.2,
      extremoSuperior: 0.15, // amplitud extremo = 0.15 - (-0.2) = 0.35 > 0.3
    };
    const filas = [...veinteFilas(1, 100), ...veinteFilas(2, 200)];
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      filas,
      { 100: SANO_EXTREMO_ESTRECHO, 200: EXTREMO_AMPLIO_Y_EN_CERO },
      0.3,
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    const resultado = await service.validarCambioPercentil(
      'percentil_extremo_inferior',
      '5',
    );

    expect(resultado.tipo).toBe('rechazado');
    if (resultado.tipo !== 'rechazado') throw new Error('esperaba rechazado');
    expect(resultado.combinaciones).toHaveLength(4);
    expect(resultado.combinaciones.every((c) => c.tipo === 'extremo')).toBe(
      true,
    );
  });

  it('pasa la clave y el valor candidato tal cual a ConsensoConfigService', async () => {
    const { prisma, statsMock, consensoConfigMock } = crearServicio(
      veinteFilas(1, 100),
      { 100: SANO },
    );
    const service = await construirServicioNest(
      prisma,
      statsMock,
      consensoConfigMock,
    );

    await service.validarCambioPercentil('percentil_extremo_superior', '95');

    expect(
      consensoConfigMock.obtenerFraccionesConCandidato,
    ).toHaveBeenCalledWith('percentil_extremo_superior', '95');
  });
});
