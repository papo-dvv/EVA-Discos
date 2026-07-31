import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import { TraceabilitySeriesQueryDto } from './dto/traceability-series-query.dto';
import { TraceabilityStatsService } from './traceability-stats.service';
import { TraceabilityService } from './traceability.service';

// Construye un TraceabilitySeriesQueryDto completo (con los defaults reales
// de la clase, incluido agregacion='auto') partiendo de overrides — mismo
// patrón que wear-rate-pairs-query.spec.ts, evita repetir cada campo en cada
// test y refleja el defaulting real que aplica el ValidationPipe en runtime.
function seriesQuery(
  overrides: Partial<TraceabilitySeriesQueryDto> = {},
): TraceabilitySeriesQueryDto {
  return Object.assign(new TraceabilitySeriesQueryDto(), overrides);
}

// Fake de Prisma que evalúa el WHERE (flat, solo igualdad de campos) contra
// un array en memoria — el WHERE de TraceabilityService.construirWhereScope
// nunca arma AND/OR/rangos, así que no hace falta el evaluador completo de
// wear-rate-pairs-query.spec.ts, solo igualdad simple por clave.
type Fila = Record<string, unknown>;

function coincide(fila: Fila, where: Fila): boolean {
  return Object.entries(where).every(([clave, valor]) => fila[clave] === valor);
}

function crearPrismaConFixture(filas: Fila[]) {
  const findManyMock = jest.fn(
    ({
      where,
      orderBy,
    }: {
      where: Fila;
      orderBy?: { fecha2?: 'asc' | 'desc' };
    }) => {
      let resultado = filas.filter((f) => coincide(f, where));
      if (orderBy?.fecha2) {
        const signo = orderBy.fecha2 === 'asc' ? 1 : -1;
        resultado = [...resultado].sort(
          (a, b) =>
            signo *
            ((a.fecha2 as Date).getTime() - (b.fecha2 as Date).getTime()),
        );
      }
      return Promise.resolve(resultado);
    },
  );
  const prisma = {
    wearRatePair: { findMany: findManyMock },
  } as unknown as PrismaService;
  return { prisma, findManyMock };
}

function fila(overrides: Fila = {}): Fila {
  return {
    esValido: true,
    trenNumero: 1,
    tipoCoche: 'MA1',
    bogieCodigo: 'PB1',
    fecha2: new Date('2026-01-01'),
    tasaMensual: 10,
    ...overrides,
  };
}

function diasAtras(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Fake de ConsensoConfigService: mismos defaults que resolvería contra un
// system_params vacío (P20/P60/P10/P90, epsilon=0.001 — ver
// consenso-config.service.ts). Todos los tests de este archivo asumen "sin
// configuración explícita", así que un solo fake fijo alcanza para los 13
// sitios que construyen TraceabilityService.
function crearConsensoConfigFake() {
  return {
    obtenerFracciones: jest.fn().mockResolvedValue({
      limiteInferior: 0.2,
      limiteSuperior: 0.6,
      extremoInferior: 0.1,
      extremoSuperior: 0.9,
    }),
    obtenerEpsilon: jest.fn().mockResolvedValue(0.001),
  };
}

describe('TraceabilityService.obtenerSummary — scope (tren/tipoCoche/bogieCodigo) y es_valido', () => {
  // <20 filas: alcanza para probar el filtrado de scope (el campo `conteo`
  // se devuelve igual en la rama datosInsuficientes) sin tener que armar 20
  // filas por cada combinación.
  const filas = [
    fila({ id: 'a', trenNumero: 1, tipoCoche: 'MA1', bogieCodigo: 'PB1' }),
    fila({ id: 'b', trenNumero: 1, tipoCoche: 'MA2', bogieCodigo: 'PB2' }),
    fila({ id: 'c', trenNumero: 2, tipoCoche: 'MA1', bogieCodigo: 'PB1' }),
    // Inválido: NUNCA debe contar, en ninguna combinación de scope.
    fila({
      id: 'd',
      trenNumero: 1,
      tipoCoche: 'MA1',
      bogieCodigo: 'PB1',
      esValido: false,
    }),
  ];

  it('sin filtros -> toda la flota, pero solo pares válidos (a, b, c)', async () => {
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});

    expect(resultado).toEqual({ datosInsuficientes: true, conteo: 3 });
  });

  it('tren=1 -> a, b y d(inválido, excluido) -> conteo 2', async () => {
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({ tren: 1 });

    expect(resultado).toEqual({ datosInsuficientes: true, conteo: 2 });
  });

  it('tren=1 & tipoCoche=MA1 -> combinados en AND -> solo a', async () => {
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({
      tren: 1,
      tipoCoche: 'MA1',
    });

    expect(resultado).toEqual({ datosInsuficientes: true, conteo: 1 });
  });

  it('bogieCodigo=PB2 -> solo b', async () => {
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({ bogieCodigo: 'PB2' });

    expect(resultado).toEqual({ datosInsuficientes: true, conteo: 1 });
  });
});

describe('TraceabilityService.obtenerSummary — umbral de 20 pares', () => {
  it('conteo < 20 -> datosInsuficientes:true y NUNCA llama a TraceabilityStatsService', async () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' }), fila({ id: 'c' })];
    const { prisma } = crearPrismaConFixture(filas);
    const statsMock = {
      calcularLimitesGauss: jest.fn(),
      calcularLimitesPercentiles: jest.fn(),
      calcularLimitesTukey: jest.fn(),
      calcularConsenso: jest.fn(),
      clasificarYLimpiarSerie: jest.fn(),
      calcularEstadisticasGenerales: jest.fn(),
    };
    const servicio = new TraceabilityService(
      prisma,
      statsMock,
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});

    expect(resultado).toEqual({ datosInsuficientes: true, conteo: 3 });
    expect(statsMock.calcularLimitesGauss).not.toHaveBeenCalled();
    expect(statsMock.clasificarYLimpiarSerie).not.toHaveBeenCalled();
    expect(statsMock.calcularEstadisticasGenerales).not.toHaveBeenCalled();
  });

  it('conteo >= 20 -> calcula los 3 métodos, consenso y estadísticas (con el TraceabilityStatsService real)', async () => {
    // Mismo dataset 1..20 que traceability-stats.service.spec.ts -> mismos
    // valores esperados, ya verificados a mano ahí.
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    const media = 10.5;
    const desviacion = Math.sqrt(35);
    expect(resultado.conteo).toBe(20);
    expect(resultado.gauss.limiteInferior).toBeCloseTo(
      media - 2 * desviacion,
      9,
    );
    expect(resultado.gauss.formula).toBe(
      'Gauss: media ± 2σ (límite), media ± 3σ (extremo)',
    );
    // P20 (default de ConsensoConfigService — ver crearConsensoConfigFake):
    // rango=(20-1)*0.20=3.8 -> entre v[3]=4 y v[4]=5 -> 4 + 1·0.8 = 4.8
    expect(resultado.percentiles.limiteInferior).toBeCloseTo(4.8, 9);
    expect(resultado.tukey.limiteInferior).toBeCloseTo(-8.5, 9);
    expect(resultado.consenso.limiteConsenso.inferior).toBeCloseTo(4.8, 9); // el más conservador de los 3
    // Con las mismas fracciones (P20/P60/P10/P90), limiteConsenso={4.8,12.4}
    // y extremoConsenso={2.9,18.1} (percentiles gana los 4 bordes, ya
    // verificado en traceability-stats.service.spec.ts). Clasificando 1..20:
    // 1,2,19,20 quedan excluidos (fuera de [2.9,18.1]); 3,4 se recortan a
    // 4.8; 13..18 se recortan a 12.4; 5..12 quedan normales (sin tocar).
    // valorLimpio = [4.8,4.8, 5,6,7,8,9,10,11,12, 12.4×6] -> 16 valores,
    // media = (9.6 + 68 + 74.4) / 16 = 152/16 = 9.5.
    expect(resultado.estadisticas.media).toBeCloseTo(9.5, 9);
    expect(resultado.estadisticas.conteo).toBe(16);
  });
});

describe('TraceabilityService.obtenerSeries — periodo no altera los límites, solo el tramo devuelto', () => {
  it('mismos límites/consenso con periodo=3m y periodo=todo; solo cambia conteoMostradoEnPeriodo', async () => {
    // 4 filas recientes (10/20/30/40 días atrás, dentro de "últimos 3 meses")
    // + 16 filas viejas (500..800 días atrás, muy fuera de cualquier
    // periodo salvo 'todo'). Los valores de tasaMensual son 1..20, el mismo
    // dataset ya verificado a mano.
    const recientes = [10, 20, 30, 40].map((dias, i) =>
      fila({ id: `r${i}`, tasaMensual: i + 1, fecha2: diasAtras(dias) }),
    );
    const viejas = Array.from({ length: 16 }, (_, i) =>
      fila({
        id: `v${i}`,
        tasaMensual: i + 5,
        fecha2: diasAtras(500 + i * 20),
      }),
    );
    const filas = [...recientes, ...viejas];
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado3m = await servicio.obtenerSeries(
      seriesQuery({ periodo: '3m', agregacion: 'crudo' }),
    );
    const resultadoTodo = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'crudo' }),
    );
    if (resultado3m.datosInsuficientes || resultadoTodo.datosInsuficientes) {
      throw new Error('esperaba datosInsuficientes:false');
    }

    // Los límites se calculan SIEMPRE sobre el histórico completo (20 filas),
    // sin importar el periodo pedido.
    expect(resultado3m.gauss).toEqual(resultadoTodo.gauss);
    expect(resultado3m.percentiles).toEqual(resultadoTodo.percentiles);
    expect(resultado3m.tukey).toEqual(resultadoTodo.tukey);
    expect(resultado3m.consenso).toEqual(resultadoTodo.consenso);
    expect(resultado3m.conteoTotalHistorico).toBe(20);
    expect(resultadoTodo.conteoTotalHistorico).toBe(20);

    // Solo el tramo de puntos devuelto cambia.
    expect(resultado3m.conteoMostradoEnPeriodo).toBe(4);
    expect(resultado3m.puntos).toHaveLength(4);
    expect(resultadoTodo.conteoMostradoEnPeriodo).toBe(20);
    expect(resultadoTodo.puntos).toHaveLength(20);
  });

  it('historico < 20 -> datosInsuficientes:true sin importar el periodo', async () => {
    const filas = [fila({ id: 'a' }), fila({ id: 'b' })];
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: '3m' }),
    );

    expect(resultado).toEqual({
      datosInsuficientes: true,
      conteoTotalHistorico: 2,
    });
  });

  it('un par inválido nunca entra al histórico ni a los puntos', async () => {
    const validas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1 }),
    );
    const invalida = fila({ id: 'inv', esValido: false, tasaMensual: 999 });
    const { prisma } = crearPrismaConFixture([...validas, invalida]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'crudo' }),
    );
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.conteoTotalHistorico).toBe(20);
    expect(resultado.puntos.every((p) => p.tasaMensualCruda !== 999)).toBe(
      true,
    );
  });
});

describe('TraceabilityService.obtenerSeries — agregacion (auto/crudo/mensual)', () => {
  // 150 filas repartidas en 3 meses calendario (50 c/u), todas con
  // tasaMensual=5 -> desviación 0 -> Gauss da un límite [5,5], así que las
  // 150 caen exactamente en el borde -> TODAS 'normal' (>= y <= son
  // inclusivos en clasificarYLimpiarSerie) -> el promedio mensual esperado
  // es simplemente 5 en los 3 meses, sin ambigüedad de clasificación.
  function fechaDia(mes: string, i: number): Date {
    const dia = String((i % 28) + 1).padStart(2, '0');
    return new Date(`2026-${mes}-${dia}`);
  }
  const CIENTOCINCUENTA = [
    ...Array.from({ length: 50 }, (_, i) =>
      fila({ id: `ene${i}`, tasaMensual: 5, fecha2: fechaDia('01', i) }),
    ),
    ...Array.from({ length: 50 }, (_, i) =>
      fila({ id: `feb${i}`, tasaMensual: 5, fecha2: fechaDia('02', i) }),
    ),
    ...Array.from({ length: 50 }, (_, i) =>
      fila({ id: `mar${i}`, tasaMensual: 5, fecha2: fechaDia('03', i) }),
    ),
  ];

  it("150 puntos en el periodo + agregacion='auto' -> agregacionAplicada='mensual', un punto por mes", async () => {
    const { prisma } = crearPrismaConFixture(CIENTOCINCUENTA);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo' }),
    ); // agregacion default = 'auto'
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.conteoMostradoEnPeriodo).toBe(150);
    expect(resultado.agregacionAplicada).toBe('mensual');
    expect(resultado.puntos).toEqual([
      {
        mes: '2026-01',
        promedioValorLimpio: 5,
        conteoNormal: 50,
        conteoRecortado: 0,
      },
      {
        mes: '2026-02',
        promedioValorLimpio: 5,
        conteoNormal: 50,
        conteoRecortado: 0,
      },
      {
        mes: '2026-03',
        promedioValorLimpio: 5,
        conteoNormal: 50,
        conteoRecortado: 0,
      },
    ]);
  });

  it("mismo periodo pero con 80 puntos + agregacion='auto' -> agregacionAplicada='crudo'", async () => {
    const ochenta = CIENTOCINCUENTA.slice(0, 80);
    const { prisma } = crearPrismaConFixture(ochenta);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo' }),
    );
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.conteoMostradoEnPeriodo).toBe(80);
    expect(resultado.agregacionAplicada).toBe('crudo');
    expect(resultado.puntos).toHaveLength(80);
  });

  it("agregacion='crudo' forzado siempre devuelve puntos individuales, sin importar el conteo (150 puntos)", async () => {
    const { prisma } = crearPrismaConFixture(CIENTOCINCUENTA);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'crudo' }),
    );
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.agregacionAplicada).toBe('crudo');
    expect(resultado.puntos).toHaveLength(150);
  });

  it("agregacion='mensual' forzado agrupa aunque el conteo sea bajo (< 100)", async () => {
    const ochenta = CIENTOCINCUENTA.slice(0, 80);
    const { prisma } = crearPrismaConFixture(ochenta);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const resultado = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'mensual' }),
    );
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.agregacionAplicada).toBe('mensual');
    // 80 = 50 de enero + 30 de febrero (slice corta a mitad de febrero).
    expect(resultado.puntos).toEqual([
      {
        mes: '2026-01',
        promedioValorLimpio: 5,
        conteoNormal: 50,
        conteoRecortado: 0,
      },
      {
        mes: '2026-02',
        promedioValorLimpio: 5,
        conteoNormal: 30,
        conteoRecortado: 0,
      },
    ]);
  });

  it("los límites/consenso NO cambian entre agregacion='crudo' y 'mensual' (mismo scope/periodo)", async () => {
    const { prisma } = crearPrismaConFixture(CIENTOCINCUENTA);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
    );

    const crudo = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'crudo' }),
    );
    const mensual = await servicio.obtenerSeries(
      seriesQuery({ periodo: 'todo', agregacion: 'mensual' }),
    );
    if (crudo.datosInsuficientes || mensual.datosInsuficientes) {
      throw new Error('esperaba datosInsuficientes:false');
    }

    expect(mensual.gauss).toEqual(crudo.gauss);
    expect(mensual.percentiles).toEqual(crudo.percentiles);
    expect(mensual.tukey).toEqual(crudo.tukey);
    expect(mensual.consenso).toEqual(crudo.consenso);
  });
});
