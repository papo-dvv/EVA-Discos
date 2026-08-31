import 'reflect-metadata';
import type { PrismaService } from '../prisma/prisma.service';
import { TraceabilitySeriesQueryDto } from './dto/traceability-series-query.dto';
import {
  calcularLimitesGauss,
  calcularLimitesPercentiles,
  TraceabilityStatsService,
} from './traceability-stats.service';
import {
  TraceabilityService,
  type PromedioPorTrenItem,
} from './traceability.service';

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

// Además de igualdad simple, soporta el filtro de rango { lt: Date } que usa
// TraceabilityService.obtenerSeriesPorTipoCoche() para excluir el mes en
// curso — el resto del archivo nunca pasa un objeto de rango, así que esto
// es puramente aditivo (no cambia el comportamiento de ningún test previo).
function coincide(fila: Fila, where: Fila): boolean {
  return Object.entries(where).every(([clave, valor]) => {
    if (
      valor !== null &&
      typeof valor === 'object' &&
      !(valor instanceof Date) &&
      'lt' in valor
    ) {
      const campo = fila[clave];
      return campo instanceof Date && campo < (valor as { lt: Date }).lt;
    }
    return fila[clave] === valor;
  });
}

// Interpreta un Prisma.Sql (obtenerSeries usa $queryRaw, no findMany — ver
// TraceabilityService.obtenerSeries/condicionesScopeSql) reconstruyendo QUÉ
// representa cada valor interpolado a partir del fragmento de texto
// INMEDIATAMENTE anterior (mismo orden en que Prisma.sql los intercala,
// verificado a mano: los fragmentos `Prisma.sql` anidados de condicionesScopeSql
// se aplanan preservando texto y orden). No parsea SQL de verdad — solo
// reconoce los marcadores exactos que la propia implementación produce, así
// que un cambio de columna/orden ahí rompe este fake tan ruidosamente como
// rompería la query real (a propósito).
interface SqlLike {
  strings: readonly string[];
  values: readonly unknown[];
}

interface ValoresInterpretados {
  tren?: number;
  tipoCoche?: string;
  bogieCodigo?: string;
  kmMin?: number;
  kmMax?: number;
  desde?: Date;
  fracciones: number[];
}

function interpretarSql(sql: SqlLike): ValoresInterpretados {
  const resultado: ValoresInterpretados = { fracciones: [] };
  for (let i = 0; i < sql.values.length; i++) {
    const antes = sql.strings[i].trimEnd();
    const valor = sql.values[i];
    if (antes.endsWith('tren_numero =')) resultado.tren = valor as number;
    else if (antes.endsWith('tipo_coche ='))
      resultado.tipoCoche = valor as string;
    else if (antes.endsWith('bogie_codigo ='))
      resultado.bogieCodigo = valor as string;
    else if (antes.endsWith('diferencia_km BETWEEN'))
      resultado.kmMin = valor as number;
    else if (
      antes.endsWith('AND') &&
      resultado.kmMin !== undefined &&
      resultado.kmMax === undefined
    )
      resultado.kmMax = valor as number;
    else if (antes.endsWith('fecha_2 >=')) resultado.desde = valor as Date;
    else if (antes.endsWith('PERCENTILE_CONT('))
      resultado.fracciones.push(valor as number);
  }
  return resultado;
}

function filasDelScope(filas: Fila[], v: ValoresInterpretados): Fila[] {
  return filas.filter((f) => {
    if (f.esValido !== true) return false;
    if (v.tren !== undefined && f.trenNumero !== v.tren) return false;
    if (v.tipoCoche !== undefined && f.tipoCoche !== v.tipoCoche) return false;
    if (v.bogieCodigo !== undefined && f.bogieCodigo !== v.bogieCodigo)
      return false;
    if (v.kmMin !== undefined || v.kmMax !== undefined) {
      const km = Number(f.diferenciaKm);
      if (v.kmMin !== undefined && km < v.kmMin) return false;
      if (v.kmMax !== undefined && km > v.kmMax) return false;
    }
    if (v.desde !== undefined && (f.fecha2 as Date) < v.desde) return false;
    return true;
  });
}

// Réplica del agregado SQL de obtenerSeries pero calculada con las mismas
// funciones puras y ya probadas de traceability-stats.service.ts — verificado
// a mano contra la base real que PERCENTILE_CONT/AVG/STDDEV_SAMP coinciden
// con esta interpolación (ver commit que introdujo esta reescritura).
function agregadoSqlFake(valores: number[], fracciones: number[]) {
  if (valores.length === 0) {
    return {
      conteo: 0,
      media: null,
      desviacion: null,
      pctLi: null,
      pctLs: null,
      pctEi: null,
      pctEs: null,
      q1: null,
      q3: null,
    };
  }
  const gauss = calcularLimitesGauss(valores);
  const media = (gauss.limiteInferior + gauss.limiteSuperior) / 2;
  const desviacion = (gauss.limiteSuperior - gauss.limiteInferior) / 4;
  const [limiteInferior, limiteSuperior, extremoInferior, extremoSuperior] =
    fracciones;
  const percentiles = calcularLimitesPercentiles(valores, {
    limiteInferior,
    limiteSuperior,
    extremoInferior,
    extremoSuperior,
  });
  const cuartiles = calcularLimitesPercentiles(valores, {
    limiteInferior: 0.25,
    limiteSuperior: 0.75,
    extremoInferior: 0,
    extremoSuperior: 1,
  });
  return {
    conteo: valores.length,
    media,
    desviacion,
    pctLi: percentiles.limiteInferior,
    pctLs: percentiles.limiteSuperior,
    pctEi: percentiles.extremoInferior,
    pctEs: percentiles.extremoSuperior,
    q1: cuartiles.limiteInferior,
    q3: cuartiles.limiteSuperior,
  };
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
  const queryRawMock = jest.fn((sql: SqlLike) => {
    const v = interpretarSql(sql);
    const delScope = filasDelScope(filas, v);

    // La consulta de agregado es la única que interpola fracciones de
    // percentil (PERCENTILE_CONT(${...})) — la de puntos del periodo no.
    if (v.fracciones.length > 0) {
      const valores = delScope.map((f) => Number(f.tasaMensual));
      return Promise.resolve([agregadoSqlFake(valores, v.fracciones)]);
    }

    const ordenadas = [...delScope].sort(
      (a, b) => (a.fecha2 as Date).getTime() - (b.fecha2 as Date).getTime(),
    );
    return Promise.resolve(
      ordenadas.map((f) => ({
        fecha2: f.fecha2,
        tasaMensual: Number(f.tasaMensual),
      })),
    );
  });
  const prisma = {
    wearRatePair: { findMany: findManyMock },
    $queryRaw: queryRawMock,
  } as unknown as PrismaService;
  return { prisma, findManyMock, queryRawMock };
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
    // paresTrasRecorte vive en la raíz de la response, mismo valor que
    // estadisticas.conteo (ambos son valoresLimpios.length).
    expect(resultado.paresTrasRecorte).toBe(16);
    expect(resultado.paresTrasRecorte).toBe(resultado.estadisticas.conteo);
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

// Busca la entrada de un tren puntual dentro del array de 39 — falla fuerte
// (en vez de devolver undefined) si el tren no está, porque el propio
// contrato del endpoint garantiza que SIEMPRE están los 39 (6..44).
function entradaTren(
  resultado: PromedioPorTrenItem[],
  tren: number,
): PromedioPorTrenItem {
  const item = resultado.find((r) => r.tren === tren);
  if (!item) throw new Error(`tren ${tren} no encontrado en el resultado`);
  return item;
}

describe('TraceabilityService.obtenerPromedioPorTren', () => {
  it('siempre devuelve 39 entradas (tren 6..44, ascendente), incluso sin ningún par en toda la flota', async () => {
    const { prisma } = crearPrismaConFixture([]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren(true, false);

    expect(resultado).toHaveLength(39);
    expect(resultado.map((r) => r.tren)).toEqual(
      Array.from({ length: 39 }, (_, i) => i + 6),
    );
    expect(resultado.every((r) => r.promedio === null)).toBe(true);
    expect(resultado.every((r) => r.paresTrasRecorte === 0)).toBe(true);
    expect(resultado.every((r) => r.conteoParesUsados === 0)).toBe(true);
    expect(resultado.every((r) => r.datosLimitados === true)).toBe(true);
    expect(resultado.every((r) => r.porTipoCoche === undefined)).toBe(true);
  });

  it('una sola consulta a Prisma con esValido:true, sin trenNumero/tipoCoche en el WHERE — agrupa los 39 trenes en memoria', async () => {
    const { prisma, findManyMock } = crearPrismaConFixture([]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    await servicio.obtenerPromedioPorTren(false, false);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const [{ where }] = findManyMock.mock.calls[0];
    expect(where).toEqual({ esValido: true });
  });

  it('agrupa por tren combinando todo tipoCoche/bogie — dataset 1..20 conocido da promedio 9.5 con 16 pares tras recorte', async () => {
    // Mismo dataset 1..20 ya verificado a mano en obtenerSummary (consenso
    // limite={4.8,12.4}, 16 limpios, media 9.5).
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `t6-${i}`, trenNumero: 6, tasaMensual: i + 1 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren(true, false);
    const tren6 = entradaTren(resultado, 6);

    expect(tren6.conteoParesUsados).toBe(20);
    expect(tren6.paresTrasRecorte).toBe(16);
    expect(tren6.promedio).toBeCloseTo(9.5, 9);
    expect(tren6.datosLimitados).toBe(false);
    expect(tren6.porTipoCoche).toBeUndefined();

    // Un tren sin pares propios queda en null/0/true, sin contaminarse con
    // los del tren 6.
    const tren7 = entradaTren(resultado, 7);
    expect(tren7.conteoParesUsados).toBe(0);
    expect(tren7.promedio).toBeNull();
    expect(tren7.datosLimitados).toBe(true);
  });

  it('filtrarPorRangoKm=true excluye pares fuera de proyeccion_km_rango_min/max antes de calcular; false los incluye', async () => {
    const dentro = Array.from({ length: 20 }, (_, i) =>
      fila({
        id: `dentro${i}`,
        trenNumero: 6,
        tasaMensual: i + 1,
        diferenciaKm: 10_000,
      }),
    );
    const fuera = Array.from({ length: 10 }, (_, i) =>
      fila({
        id: `fuera${i}`,
        trenNumero: 6,
        tasaMensual: 500 + i,
        diferenciaKm: 40_000,
      }),
    );
    const { prisma } = crearPrismaConFixture([...dentro, ...fuera]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(), // default 7000-15000
    );

    const filtrado = entradaTren(
      await servicio.obtenerPromedioPorTren(true, false),
      6,
    );
    const sinFiltrar = entradaTren(
      await servicio.obtenerPromedioPorTren(false, false),
      6,
    );

    expect(filtrado.conteoParesUsados).toBe(20);
    expect(filtrado.promedio).toBeCloseTo(9.5, 9);

    expect(sinFiltrar.conteoParesUsados).toBe(30);
    expect(sinFiltrar.promedio).not.toBeCloseTo(9.5, 9);
  });

  it('tren con solo 12 pares (< CONTEO_MINIMO=20) igual calcula el promedio, marcado datosLimitados:true', async () => {
    const filas = Array.from({ length: 12 }, (_, i) =>
      fila({ id: `t6-${i}`, trenNumero: 6, tasaMensual: i + 1 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const tren6 = entradaTren(
      await servicio.obtenerPromedioPorTren(true, false),
      6,
    );

    expect(tren6.conteoParesUsados).toBe(12);
    expect(tren6.datosLimitados).toBe(true);
    expect(tren6.promedio).not.toBeNull();
    expect(tren6.paresTrasRecorte).toBeGreaterThan(0);
  });

  it('tren sin pares (0) devuelve promedio null', async () => {
    // Solo el tren 7 tiene filas — el 6 queda en 0 pares.
    const filas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `t7-${i}`, trenNumero: 7, tasaMensual: i + 1 }),
    );
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const tren6 = entradaTren(
      await servicio.obtenerPromedioPorTren(true, false),
      6,
    );

    expect(tren6.conteoParesUsados).toBe(0);
    expect(tren6.promedio).toBeNull();
    expect(tren6.paresTrasRecorte).toBe(0);
  });

  it('con menos de 3 pares (piso técnico) el pipeline ni corre -> promedio null', async () => {
    const filas = [
      fila({ id: 'a', trenNumero: 6, tasaMensual: 5 }),
      fila({ id: 'b', trenNumero: 6, tasaMensual: 6 }),
    ];
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const tren6 = entradaTren(
      await servicio.obtenerPromedioPorTren(true, false),
      6,
    );

    expect(tren6.conteoParesUsados).toBe(2);
    expect(tren6.promedio).toBeNull();
    expect(tren6.paresTrasRecorte).toBe(0);
    expect(tren6.datosLimitados).toBe(true);
  });

  it('un par inválido nunca cuenta', async () => {
    const validas = Array.from({ length: 20 }, (_, i) =>
      fila({ id: `t6-${i}`, trenNumero: 6, tasaMensual: i + 1 }),
    );
    const invalida = fila({
      id: 'inv',
      trenNumero: 6,
      esValido: false,
      tasaMensual: 999,
    });
    const { prisma } = crearPrismaConFixture([...validas, invalida]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const tren6 = entradaTren(
      await servicio.obtenerPromedioPorTren(true, false),
      6,
    );

    expect(tren6.conteoParesUsados).toBe(20);
  });

  it('el resultado siempre viene ordenado ascendente de tren 6 a 44, sin importar el orden de inserción de las filas', async () => {
    const filas = [
      fila({ id: 'x44', trenNumero: 44, tasaMensual: 5 }),
      fila({ id: 'x6', trenNumero: 6, tasaMensual: 5 }),
      fila({ id: 'x25', trenNumero: 25, tasaMensual: 5 }),
    ];
    const { prisma } = crearPrismaConFixture(filas);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren(true, false);

    expect(resultado.map((r) => r.tren)).toEqual(
      Array.from({ length: 39 }, (_, i) => i + 6),
    );
  });

  it('incluirDetalle=true agrega 6 entradas de porTipoCoche (una por TipoCoche) en cada uno de los 39 trenes', async () => {
    const { prisma } = crearPrismaConFixture([]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerPromedioPorTren(true, true);

    expect(resultado).toHaveLength(39);
    for (const item of resultado) {
      expect(item.porTipoCoche).toHaveLength(6);
      expect(
        [...(item.porTipoCoche ?? [])].map((t) => t.tipoCoche).sort(),
      ).toEqual(['MA1', 'MA2', 'MB1', 'MB2', 'MB3', 'REM'].sort());
    }
  });

  it('incluirDetalle=true calcula cada tipoCoche de forma independiente dentro de un mismo tren', async () => {
    const ma1 = Array.from({ length: 20 }, (_, i) =>
      fila({
        id: `ma1-${i}`,
        trenNumero: 6,
        tipoCoche: 'MA1',
        tasaMensual: i + 1,
      }),
    );
    const mb1 = Array.from({ length: 5 }, (_, i) =>
      fila({
        id: `mb1-${i}`,
        trenNumero: 6,
        tipoCoche: 'MB1',
        tasaMensual: 100 + i,
      }),
    );
    const { prisma } = crearPrismaConFixture([...ma1, ...mb1]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const tren6 = entradaTren(
      await servicio.obtenerPromedioPorTren(true, true),
      6,
    );

    // El tren combinado (sin desglose) mezcla ambos tipoCoche.
    expect(tren6.conteoParesUsados).toBe(25);

    const detalleMa1 = tren6.porTipoCoche?.find((t) => t.tipoCoche === 'MA1');
    const detalleMb1 = tren6.porTipoCoche?.find((t) => t.tipoCoche === 'MB1');
    const detalleMb3 = tren6.porTipoCoche?.find((t) => t.tipoCoche === 'MB3');

    expect(detalleMa1?.conteoParesUsados).toBe(20);
    expect(detalleMa1?.promedio).toBeCloseTo(9.5, 9);
    expect(detalleMb1?.conteoParesUsados).toBe(5);
    expect(detalleMb3?.conteoParesUsados).toBe(0);
    expect(detalleMb3?.promedio).toBeNull();
  });
});

describe('TraceabilityService.obtenerSeriesPorTipoCoche', () => {
  // Reemplaza WearRateService.obtenerChartPorTipoCoche() — mismo pipeline de
  // "dato limpio" que el resto de Trazabilidad (consenso sobre el histórico
  // COMPLETO del tipo de coche, no por balde mes+tipo).
  function unMesDelAnioActual(mesIndice: number): Date {
    return new Date(Date.UTC(new Date().getUTCFullYear(), mesIndice, 15));
  }

  it('siempre devuelve las 12 filas del año en curso (enero a diciembre), con null en los 6 tipos si no hay ningún par', async () => {
    const { prisma } = crearPrismaConFixture([]);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSeriesPorTipoCoche();

    expect(resultado).toHaveLength(12);
    const anioActual = new Date().getUTCFullYear();
    expect(resultado.map((f) => f.mes)).toEqual(
      Array.from(
        { length: 12 },
        (_, i) => `${anioActual}-${String(i + 1).padStart(2, '0')}`,
      ),
    );
    for (const fila of resultado) {
      expect(fila.MA1).toBeNull();
      expect(fila.MB1).toBeNull();
      expect(fila.MB3).toBeNull();
      expect(fila.REM).toBeNull();
      expect(fila.MB2).toBeNull();
      expect(fila.MA2).toBeNull();
    }
  });

  it('mismo dataset 1..20 ya verificado en obtenerSummary/obtenerPromedioPorTren (consenso limite={4.8,12.4}) da promedio 9.5 para MA1 en su mes, sin afectar otros tipos', async () => {
    const mes = unMesDelAnioActual(0); // enero del año en curso
    const ma1 = Array.from({ length: 20 }, (_, i) =>
      fila({
        id: `ma1-${i}`,
        tipoCoche: 'MA1',
        tasaMensual: i + 1,
        fecha2: mes,
      }),
    );
    const { prisma } = crearPrismaConFixture(ma1);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSeriesPorTipoCoche();
    const filaEnero = resultado.find(
      (f) => f.mes === `${mes.getUTCFullYear()}-01`,
    )!;

    expect(filaEnero.MA1).toBeCloseTo(9.5, 9);
    expect(filaEnero.MB1).toBeNull();
  });

  it('menos de CONTEO_MINIMO (20) pares históricos para un tipo de coche -> ese tipo sale null en todos los meses', async () => {
    const mes = unMesDelAnioActual(0);
    const ma1 = Array.from({ length: 19 }, (_, i) =>
      fila({
        id: `ma1-${i}`,
        tipoCoche: 'MA1',
        tasaMensual: i + 1,
        fecha2: mes,
      }),
    );
    const { prisma } = crearPrismaConFixture(ma1);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSeriesPorTipoCoche();

    expect(resultado.every((f) => f.MA1 === null)).toBe(true);
  });

  it('el mes calendario en curso nunca entra (todavía sin cerrar), igual que WearRateService.obtenerChart', async () => {
    const ahora = new Date();
    const mesActual = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 15),
    );
    const ma1 = Array.from({ length: 20 }, (_, i) =>
      fila({
        id: `ma1-actual-${i}`,
        tipoCoche: 'MA1',
        tasaMensual: i + 1,
        fecha2: mesActual,
      }),
    );
    const { prisma, findManyMock } = crearPrismaConFixture(ma1);
    const servicio = new TraceabilityService(
      prisma,
      new TraceabilityStatsService(),
      crearConsensoConfigFake(),
      crearAsimetriaConfigFake(),
      crearProyeccionConfigFake(),
    );

    const resultado = await servicio.obtenerSeriesPorTipoCoche();

    // Las 20 filas del mes en curso quedan excluidas por el where -> el fake
    // de Prisma no devuelve nada -> menos de CONTEO_MINIMO -> MA1 null en
    // todos los meses.
    expect(resultado.every((f) => f.MA1 === null)).toBe(true);
    const wheresConTipo = findManyMock.mock.calls
      .map(([args]: [{ where: Fila }]) => args.where)
      .filter((w: Fila) => w.tipoCoche === 'MA1');
    expect(wheresConTipo.length).toBeGreaterThan(0);
  });
});
