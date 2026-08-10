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
    // 10_000 cae dentro de [7000, 15000] (ver KM_RANGO_INFERIOR/SUPERIOR en
    // TraceabilityService) -> por defecto toda fila entra a promedioRangoKm,
    // salvo que un test la excluya explícitamente con un override.
    diferenciaKm: 10_000,
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

// Fake de AsimetriaConfigService: mismo default que resolvería contra un
// system_params vacío (0.5 — ver asimetria-config.service.ts).
function crearAsimetriaConfigFake(umbral = 0.5) {
  return {
    obtenerUmbralSimetrica: jest.fn().mockResolvedValue(umbral),
  };
}

// Fake de ProyeccionConfigService: MISMOS valores por defecto que
// KM_RANGO_INFERIOR/SUPERIOR (7000/15000, ver traceability.service.ts) — así
// el diferenciaKm=10_000 por defecto de fila() sigue cayendo dentro del rango
// con filtrarPorRangoKm=true, y todos los tests preexistentes (que no pasan
// filtrarPorRangoKm) no cambian de comportamiento. Los tests que sí ejercitan
// el toggle pasan un rango propio.
function crearProyeccionConfigFake(kmMin = 7000, kmMax = 15000) {
  return {
    obtenerRangoKm: jest.fn().mockResolvedValue({ kmMin, kmMax }),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
    // Asimetría de Fisher-Pearson ajustada sobre esos mismos 16 valorLimpio
    // (calculado aparte con la misma fórmula, ver traceability-stats.service.spec.ts
    // para el detalle de calcularAsimetria) -> |-0.451| < 0.5 (umbral default
    // de crearAsimetriaConfigFake) -> SIMETRICA.
    expect(resultado.asimetria.coeficiente).toBeCloseTo(
      -0.45111866735475054,
      9,
    );
    expect(resultado.asimetria.clasificacion).toBe('SIMETRICA');
    // Las 20 filas usan el diferenciaKm por defecto de fila() (10_000, dentro
    // de [7000, 15000]) -> el subconjunto por km ES el conjunto completo, así
    // que su consenso propio coincide con el global y su promedio con la media
    // de estadisticas.
    expect(resultado.promedioRangoKm.kmMinimo).toBe(7000);
    expect(resultado.promedioRangoKm.kmMaximo).toBe(15000);
    expect(resultado.promedioRangoKm.conteo).toBe(20);
    expect(resultado.promedioRangoKm.confiable).toBe(true);
    expect(resultado.promedioRangoKm.consenso).toEqual(resultado.consenso);
    expect(resultado.promedioRangoKm.conteoLimpio).toBe(16);
    expect(resultado.promedioRangoKm.promedio).toBeCloseTo(9.5, 9);
  });

  it('asimetria: el umbral configurable (asimetria_umbral_simetrica) mueve el límite de clasificación', async () => {
    // Mismo dataset y coeficiente (~-0.4511) que el test anterior — solo
    // cambia el umbral inyectado vía AsimetriaConfigService.
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(0.4), // |-0.4511| >= 0.4 -> ya no es SIMETRICA
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.asimetria.coeficiente).toBeCloseTo(
      -0.45111866735475054,
      9,
    );
    expect(resultado.asimetria.clasificacion).toBe('SESGO_NEGATIVO');
  });

  it('promedioRangoKm calcula su PROPIO consenso sobre los pares del rango, no hereda el global', async () => {
    // 20 filas 1..20 dentro del rango de km (mismo dataset ya verificado a
    // mano arriba: consenso limite={4.8,12.4}, 16 limpios, media 9.5) + 10
    // filas con tasas extremas FUERA del rango de km. Esas 10 mueven el
    // consenso global, pero no deben tocar el del subconjunto: es exactamente
    // la diferencia entre calcular aparte y heredar los límites de arriba.
    const dentro = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `dentro${i}`, tasaMensual: i + 1, diferenciaKm: 10_000 }),
    );
    const fuera = Array.from({ length: 10 }, (_, i) =>
      fila({ id: `fuera${i}`, tasaMensual: 500 + i, diferenciaKm: 40_000 }),
    );
    const { prisma } = crearPrismaConFixture([...dentro, ...fuera]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    // El subconjunto (las 20 en rango) reproduce exactamente el consenso del
    // test anterior, ajeno a las 10 filas extremas.
    expect(resultado.promedioRangoKm.conteo).toBe(20);
    expect(resultado.promedioRangoKm.confiable).toBe(true);
    expect(
      resultado.promedioRangoKm.consenso?.limiteConsenso.inferior,
    ).toBeCloseTo(4.8, 9);
    expect(
      resultado.promedioRangoKm.consenso?.limiteConsenso.superior,
    ).toBeCloseTo(12.4, 9);
    expect(resultado.promedioRangoKm.conteoLimpio).toBe(16);
    expect(resultado.promedioRangoKm.promedio).toBeCloseTo(9.5, 9);
    // ...y el global, contaminado por las 10 extremas, es OTRO.
    expect(resultado.consenso.limiteConsenso.superior).not.toBeCloseTo(12.4, 9);
  });

  it('promedioRangoKm marca confiable:false con menos de 20 pares en el rango, pero calcula igual', async () => {
    // 5 filas en rango (>= CONTEO_MINIMO_CALCULABLE, < CONTEO_MINIMO) + 20
    // fuera, para que el summary global sí supere el umbral y llegue a la
    // rama de cálculo.
    const dentro = Array.from({ length: 5 }, (_, i) =>
      fila({ id: `dentro${i}`, tasaMensual: i + 1, diferenciaKm: 10_000 }),
    );
    const fuera = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `fuera${i}`, tasaMensual: i + 1, diferenciaKm: 40_000 }),
    );
    const { prisma } = crearPrismaConFixture([...dentro, ...fuera]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.promedioRangoKm.conteo).toBe(5);
    expect(resultado.promedioRangoKm.confiable).toBe(false);
    // Decisión de producto: con pocos datos igual se calcula (marcado como
    // poco confiable), NO se devuelve vacío.
    expect(resultado.promedioRangoKm.consenso).not.toBeNull();
    expect(resultado.promedioRangoKm.promedio).not.toBeNull();
    expect(resultado.promedioRangoKm.conteoLimpio).toBeGreaterThan(0);
  });

  it('promedioRangoKm queda en null cuando no hay con qué calcular (0 pares en el rango)', async () => {
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1, diferenciaKm: 500 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.promedioRangoKm).toEqual({
      kmMinimo: 7000,
      kmMaximo: 15000,
      conteo: 0,
      confiable: false,
      consenso: null,
      conteoLimpio: 0,
      promedio: null,
    });
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
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

describe('TraceabilityService.obtenerSummary — filtrarPorRangoKm', () => {
  // Mismo fixture ya verificado a mano en "promedioRangoKm calcula su PROPIO
  // consenso...": 20 pares dentro de [7000,15000] (dataset 1..20, consenso
  // limpio ya conocido: limiteConsenso={4.8,12.4}, media 9.5) + 10 pares MUY
  // fuera de rango (diferenciaKm=40_000, tasaMensual=500+i) que contaminan
  // cualquier cálculo que los incluya.
  function fixtureDentroYFuera() {
    const dentro = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `dentro${i}`, tasaMensual: i + 1, diferenciaKm: 10_000 }),
    );
    const fuera = Array.from({ length: 10 }, (_, i) =>
      fila({ id: `fuera${i}`, tasaMensual: 500 + i, diferenciaKm: 40_000 }),
    );
    return [...dentro, ...fuera];
  }

  it('filtrarPorRangoKm=true excluye los pares fuera de proyeccion_km_rango_min/max; false los incluye -> consenso distinto', async () => {
    const { prisma } = crearPrismaConFixture(fixtureDentroYFuera());
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(), // default 7000-15000
    );

    const filtrado = await servicio.obtenerSummary({ filtrarPorRangoKm: true });
    const sinFiltrar = await servicio.obtenerSummary({
      filtrarPorRangoKm: false,
    });
    if (filtrado.datosInsuficientes || sinFiltrar.datosInsuficientes) {
      throw new Error('esperaba datosInsuficientes:false en ambos');
    }

    // Con el filtro activo, quedan solo los 20 "dentro" -> mismo consenso
    // limpio ya verificado a mano (limiteConsenso.superior=12.4).
    expect(filtrado.conteo).toBe(20);
    expect(filtrado.consenso.limiteConsenso.superior).toBeCloseTo(12.4, 9);

    // Sin filtro, las 30 filas completas (incluidas las 10 extremas)
    // contaminan el consenso -> resultado distinto.
    expect(sinFiltrar.conteo).toBe(30);
    expect(sinFiltrar.consenso.limiteConsenso.superior).not.toBeCloseTo(
      12.4,
      9,
    );
    expect(sinFiltrar.consenso).not.toEqual(filtrado.consenso);
  });

  it('promedioRangoKm NUNCA se ve afectado por filtrarPorRangoKm (siempre corre sobre el scope completo)', async () => {
    const { prisma } = crearPrismaConFixture(fixtureDentroYFuera());
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const filtrado = await servicio.obtenerSummary({ filtrarPorRangoKm: true });
    const sinFiltrar = await servicio.obtenerSummary({
      filtrarPorRangoKm: false,
    });
    if (filtrado.datosInsuficientes || sinFiltrar.datosInsuficientes) {
      throw new Error('esperaba datosInsuficientes:false en ambos');
    }

    expect(filtrado.promedioRangoKm).toEqual(sinFiltrar.promedioRangoKm);
    expect(filtrado.promedioRangoKm.conteo).toBe(20);
  });

  it('un objeto plano sin filtrarPorRangoKm (undefined) se comporta como false, NO filtra — el default=true vive en el DTO (ver Transform), no en el servicio', async () => {
    const { prisma } = crearPrismaConFixture(fixtureDentroYFuera());
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSummary({});
    if (resultado.datosInsuficientes)
      throw new Error('esperaba datosInsuficientes:false');

    expect(resultado.conteo).toBe(30);
  });

  it('filtrarPorRangoKm nunca toca el cálculo interno de Proyección: ProyeccionConfigService solo se consulta cuando el toggle está activo', async () => {
    const { prisma } = crearPrismaConFixture(fixtureDentroYFuera());
    const proyeccionConfigFake = crearProyeccionConfigFake();
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      proyeccionConfigFake,
    );

    await servicio.obtenerSummary({ filtrarPorRangoKm: false });
    expect(proyeccionConfigFake.obtenerRangoKm).not.toHaveBeenCalled();

    await servicio.obtenerSummary({ filtrarPorRangoKm: true });
    expect(proyeccionConfigFake.obtenerRangoKm).toHaveBeenCalledTimes(1);
  });
});

describe('TraceabilityService.obtenerSeries — filtrarPorRangoKm', () => {
  it('filtrarPorRangoKm=true vs false cambia conteoTotalHistorico y consenso cuando hay pares fuera de rango', async () => {
    const dentro = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `dentro${i}`, tasaMensual: i + 1, diferenciaKm: 10_000 }),
    );
    const fuera = Array.from({ length: 10 }, (_, i) =>
      fila({ id: `fuera${i}`, tasaMensual: 500 + i, diferenciaKm: 40_000 }),
    );
    const { prisma } = crearPrismaConFixture([...dentro, ...fuera]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const filtrado = await servicio.obtenerSeries(
      seriesQuery({
        periodo: 'todo',
        agregacion: 'crudo',
        filtrarPorRangoKm: true,
      }),
    );
    const sinFiltrar = await servicio.obtenerSeries(
      seriesQuery({
        periodo: 'todo',
        agregacion: 'crudo',
        filtrarPorRangoKm: false,
      }),
    );
    if (filtrado.datosInsuficientes || sinFiltrar.datosInsuficientes) {
      throw new Error('esperaba datosInsuficientes:false en ambos');
    }

    expect(filtrado.conteoTotalHistorico).toBe(20);
    expect(sinFiltrar.conteoTotalHistorico).toBe(30);
    expect(filtrado.consenso).not.toEqual(sinFiltrar.consenso);
  });
});

describe('TraceabilityService.obtenerPromedioPorTren', () => {
  it('sin tren -> promedia TODA la flota, sin filtrar por tipoCoche/bogieCodigo', async () => {
    const filas = [
      ...Array.from({ length: 10 }, (_, i) =>
        fila({
          id: `t1-${i}`,
          trenNumero: 1,
          tipoCoche: 'MA1',
          bogieCodigo: 'PB1',
          tasaMensual: i + 1,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        fila({
          id: `t2-${i}`,
          trenNumero: 2,
          tipoCoche: 'MB1',
          bogieCodigo: 'PB2',
          tasaMensual: i + 11,
        }),
      ),
    ];
    const { prisma, findManyMock } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren();

    expect(resultado.tren).toBeNull();
    expect(resultado.conteo).toBe(20);
    // El WHERE nunca agrega trenNumero/tipoCoche/bogieCodigo cuando no se
    // pide un tren puntual — solo esValido:true.
    const [{ where }] = findManyMock.mock.calls[0];
    expect(where).toEqual({ esValido: true });
  });

  it('tren=1 -> promedia SOLO ese tren, combinando todos sus tipoCoche/bogie juntos', async () => {
    const filas = [
      ...Array.from({ length: 20 }, (_, i) =>
        fila({
          id: `t1-${i}`,
          trenNumero: 1,
          tipoCoche: i % 2 === 0 ? 'MA1' : 'MB1',
          bogieCodigo: i % 2 === 0 ? 'PB1' : 'PB2',
          tasaMensual: i + 1,
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fila({ id: `t2-${i}`, trenNumero: 2, tasaMensual: 999 }),
      ),
    ];
    const { prisma, findManyMock } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren(1);

    expect(resultado.tren).toBe(1);
    expect(resultado.conteo).toBe(20);
    const [{ where }] = findManyMock.mock.calls[0];
    expect(where).toEqual({ esValido: true, trenNumero: 1 });
  });

  it('NUNCA filtra por rango de km (ni el fijo de Trazabilidad ni el configurable de Proyección)', async () => {
    // Mismo dataset 1..20 ya verificado a mano (media limpia 9.5, 16
    // limpios), pero con diferenciaKm bien fuera de CUALQUIER rango conocido
    // — si este método filtrara por km, quedaría en datosInsuficientes o con
    // otro resultado.
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1, diferenciaKm: 1_000_000 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren();

    expect(resultado.conteo).toBe(20);
    expect(resultado.confiable).toBe(true);
    expect(resultado.conteoLimpio).toBe(16);
    expect(resultado.promedio).toBeCloseTo(9.5, 9);
  });

  it('un par inválido nunca cuenta', async () => {
    const validas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `v${i}`, tasaMensual: i + 1 }),
    );
    const invalida = fila({ id: 'inv', esValido: false, tasaMensual: 999 });
    const { prisma } = crearPrismaConFixture([...validas, invalida]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren();

    expect(resultado.conteo).toBe(20);
  });

  it('con menos de 2 pares no hay con qué calcular -> consenso y promedio null', async () => {
    const { prisma } = crearPrismaConFixture([fila({ id: 'a' })]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren();

    expect(resultado).toEqual({
      tren: null,
      conteo: 1,
      confiable: false,
      consenso: null,
      conteoLimpio: 0,
      promedio: null,
    });
  });
});
