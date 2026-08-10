import type { PrismaService } from '../prisma/prisma.service';
import { ConsensoConfigService } from '../traceability/consenso-config.service';
import { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { ProyeccionConfigService } from './proyeccion-config.service';
import { ProyeccionRateService } from './proyeccion-rate.service';

type Fila = {
  esValido: boolean;
  tipoCoche: string;
  diferenciaKm: number;
  tasaMensual: number;
  fecha2: Date;
};

function fila(overrides: Partial<Fila> = {}): Fila {
  return {
    esValido: true,
    tipoCoche: 'MA1',
    diferenciaKm: 10_000,
    tasaMensual: 10,
    fecha2: new Date('2026-01-01'),
    ...overrides,
  };
}

// Fake mínimo de wearRatePair.findMany: solo entiende esValido/tipoCoche
// (igualdad) y diferenciaKm (rango gte/lte) — lo único que arma
// ProyeccionRateService.calcularTasaPromedioPorTipoCoche.
function crearPrismaConFixture(filas: Fila[]) {
  const findManyMock = jest.fn(
    ({
      where,
    }: {
      where: {
        esValido: boolean;
        tipoCoche: string;
        diferenciaKm: { gte: number; lte: number };
      };
    }) => {
      const resultado = filas.filter(
        (f) =>
          f.esValido === where.esValido &&
          f.tipoCoche === where.tipoCoche &&
          f.diferenciaKm >= where.diferenciaKm.gte &&
          f.diferenciaKm <= where.diferenciaKm.lte,
      );
      return Promise.resolve(resultado);
    },
  );
  const prisma = {
    wearRatePair: { findMany: findManyMock },
  } as unknown as PrismaService;
  return { prisma, findManyMock };
}

// Mismos defaults que resolvería ConsensoConfigService contra system_params
// vacío (P25/P75/P10/P90, epsilon=0.001).
function crearConsensoConfigFake() {
  return {
    obtenerFracciones: jest.fn().mockResolvedValue({
      limiteInferior: 0.25,
      limiteSuperior: 0.75,
      extremoInferior: 0.1,
      extremoSuperior: 0.9,
    }),
    obtenerEpsilon: jest.fn().mockResolvedValue(0.001),
  } as unknown as ConsensoConfigService;
}

function crearProyeccionConfigFake(kmMin = 7000, kmMax = 15000) {
  return {
    obtenerRangoKm: jest.fn().mockResolvedValue({ kmMin, kmMax }),
  } as unknown as ProyeccionConfigService;
}

function filasValidasHomogeneas(cantidad: number, tipoCoche = 'MA1'): Fila[] {
  // Todas con la misma tasaMensual=10: consenso trivial (desviación 0), así
  // que TODAS sobreviven el recorte y el promedio da exactamente 10 — sirve
  // para aislar el umbral de conteo mínimo del resto del cálculo.
  return Array.from({ length: cantidad }, (_, i) =>
    fila({ tipoCoche, fecha2: new Date(2026, 0, i + 1) }),
  );
}

describe('ProyeccionRateService.calcularTasaPromedioPorTipoCoche', () => {
  function crearService(filas: Fila[]) {
    const { prisma, findManyMock } = crearPrismaConFixture(filas);
    const service = new ProyeccionRateService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearProyeccionConfigFake(),
    );
    return { service, findManyMock };
  }

  it('menos de 20 pares válidos en el rango -> null', async () => {
    const { service } = crearService(filasValidasHomogeneas(19));
    expect(await service.calcularTasaPromedioPorTipoCoche('MA1')).toBeNull();
  });

  it('20 pares válidos homogéneos en el rango -> promedio de valorLimpio', async () => {
    const { service } = crearService(filasValidasHomogeneas(20));
    const resultado = await service.calcularTasaPromedioPorTipoCoche('MA1');
    expect(resultado).toBeCloseTo(10);
  });

  it('filtra por tipoCoche: pares de otro tipo no cuentan', async () => {
    const filas = [
      ...filasValidasHomogeneas(20, 'MA1'),
      ...filasValidasHomogeneas(20, 'MB1'),
    ];
    const { service } = crearService(filas);
    // MA1 sigue teniendo exactamente 20 propios -> alcanza.
    expect(await service.calcularTasaPromedioPorTipoCoche('MA1')).toBeCloseTo(
      10,
    );
  });

  it('un tipo de coche sin pares en absoluto -> null, sin reventar', async () => {
    const { service } = crearService(filasValidasHomogeneas(20, 'MA1'));
    expect(await service.calcularTasaPromedioPorTipoCoche('REM')).toBeNull();
  });

  it('excluye pares fuera del rango de km configurado', async () => {
    const dentro = filasValidasHomogeneas(20, 'MA1');
    const fuera = Array.from({ length: 5 }, (_, i) =>
      fila({
        tipoCoche: 'MA1',
        diferenciaKm: 500, // fuera de [7000, 15000]
        fecha2: new Date(2026, 1, i + 1),
      }),
    );
    const { service, findManyMock } = crearService([...dentro, ...fuera]);
    await service.calcularTasaPromedioPorTipoCoche('MA1');
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.diferenciaKm).toEqual({ gte: 7000, lte: 15000 });
  });

  it('un outlier extremo se recorta (valorLimpio), no arrastra el promedio', async () => {
    const homogeneas = filasValidasHomogeneas(19, 'MA1');
    const outlier = fila({
      tipoCoche: 'MA1',
      tasaMensual: 9999,
      fecha2: new Date(2026, 2, 1),
    });
    const { service } = crearService([...homogeneas, outlier]);
    const resultado = await service.calcularTasaPromedioPorTipoCoche('MA1');
    // El outlier se recorta al borde del consenso, nunca promedia su valor
    // crudo -> el resultado queda muy por debajo de lo que un promedio
    // aritmético ingenuo (que incluye 9999) daría.
    expect(resultado).not.toBeNull();
    expect(resultado!).toBeLessThan(100);
  });
});

describe('ProyeccionRateService.calcularTasasPorTipoCoche', () => {
  it('devuelve los 6 tipos de coche, cada uno independiente', async () => {
    const { prisma } = crearPrismaConFixture(filasValidasHomogeneas(20, 'MA1'));
    const service = new ProyeccionRateService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearProyeccionConfigFake(),
    );
    const resultado = await service.calcularTasasPorTipoCoche();
    expect(Object.keys(resultado).sort()).toEqual(
      ['MA1', 'MA2', 'MB1', 'MB2', 'MB3', 'REM'].sort(),
    );
    expect(resultado.MA1).toBeCloseTo(10);
    expect(resultado.MB1).toBeNull();
  });
});
