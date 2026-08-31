import 'reflect-metadata';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import type { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsensoConfigService } from '../traceability/consenso-config.service';
import type { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { WearRateChartQueryDto } from './dto/wear-rate-chart-query.dto';
import { WearRatePairsQueryDto } from './dto/wear-rate-pairs-query.dto';
import { WearRateSummaryQueryDto } from './dto/wear-rate-summary-query.dto';
import { WearRateCalculatorService } from './wear-rate-calculator.service';
import { WearRateService } from './wear-rate.service';

// Fake de Prisma que EVALÚA el WHERE contra un array en memoria (mismo
// patrón que scan-records.service.spec.ts): permite probar de verdad que un
// filtro combinado excluye filas, no solo que se llamó con cierto argumento.
type Registro = Record<string, unknown>;
type Condicion = Record<string, unknown>;

function coincideCampo(valor: unknown, filtro: unknown): boolean {
  if (filtro === null) return valor === null;
  if (typeof filtro !== 'object' || filtro instanceof Date) {
    return valor === filtro;
  }
  const f = filtro as Record<string, unknown>;
  if ('in' in f) return (f.in as unknown[]).includes(valor);
  if ('gte' in f || 'lte' in f || 'gt' in f || 'lt' in f) {
    if (valor === null || valor === undefined) return false;
    const num = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));
    const v = num(valor);
    if (f.gte !== undefined && v < num(f.gte)) return false;
    if (f.lte !== undefined && v > num(f.lte)) return false;
    if (f.gt !== undefined && v <= num(f.gt)) return false;
    if (f.lt !== undefined && v >= num(f.lt)) return false;
    return true;
  }
  return true;
}

function coincideCondicion(fila: Registro, cond: Condicion): boolean {
  return Object.entries(cond).every(([clave, valor]) => {
    if (clave === 'AND') {
      return (valor as Condicion[]).every((c) => coincideCondicion(fila, c));
    }
    if (clave === 'OR') {
      return (valor as Condicion[]).some((c) => coincideCondicion(fila, c));
    }
    return coincideCampo(fila[clave], valor);
  });
}

// discos/medicionesPorDisco: solo los usan los tests de accionRecomendada
// (ver resolverAccionPorDiscId) — el resto de tests de este archivo ni los
// pasa, así que brakeDisc.findMany devuelve [] y no afecta nada (mismo
// patrón que scan-records.service.spec.ts).
function crearPrismaConFixture(
  registros: Registro[],
  discos: Registro[] = [],
  medicionesPorDisco: Record<string, { hValue: number; rdValue: number }> = {},
) {
  const findManyMock = jest.fn(
    ({
      where,
      skip,
      take,
    }: {
      where: Condicion;
      skip?: number;
      take?: number;
    }) => {
      let filas = registros.filter((r) => coincideCondicion(r, where));
      filas = [...filas].sort((a, b) =>
        (a.id as string).localeCompare(b.id as string),
      );
      if (skip !== undefined) filas = filas.slice(skip);
      if (take !== undefined) filas = filas.slice(0, take);
      return Promise.resolve(filas);
    },
  );
  const countMock = jest.fn(({ where }: { where: Condicion }) =>
    Promise.resolve(
      registros.filter((r) => coincideCondicion(r, where)).length,
    ),
  );

  const prisma = {
    wearRatePair: { findMany: findManyMock, count: countMock },
    brakeDisc: {
      findMany: jest.fn(({ where }: { where: Condicion }) =>
        Promise.resolve(discos.filter((d) => coincideCondicion(d, where))),
      ),
    },
    scanRecord: {
      findFirst: jest.fn(({ where }: { where: { discId: string } }) =>
        Promise.resolve(medicionesPorDisco[where.discId] ?? null),
      ),
    },
    // obtenerChart() lee tasa_desgaste_km_maximo (ver
    // obtenerDiferenciaKmMaximaVigente) — sin fila, cae al valor por defecto,
    // que es lo que ejercitan los tests de este archivo.
    systemParam: {
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  } as unknown as PrismaService;

  return { prisma, findManyMock, countMock };
}

function fila(overrides: Registro = {}): Registro {
  return {
    id: 'wrp-1',
    discId: 'disco-1',
    trenNumero: 6,
    fecha1: new Date('2024-01-01'),
    km1: 100_000,
    rd1: 10,
    fecha2: new Date('2024-02-01'),
    km2: 105_000,
    rd2: 9.5,
    motivo2: 'Medición',
    diferenciaKm: 5_000,
    diferenciaRd: 0.5,
    tasa: 0.0001,
    kmMensualUsado: 11_300,
    tasaMensual: 1.13,
    comentario: 'Válido',
    esValido: true,
    tipoCoche: 'MA1',
    numeroCoche: 129,
    bogieCodigo: 'PB2',
    ejeNumero: 1,
    lado: 'izquierdo',
    ...overrides,
  };
}

// Construye un DTO completo (con los defaults reales de la clase) partiendo
// de overrides — evita repetir page/pageSize/sortBy/sortDir en cada test.
function query(
  overrides: Partial<WearRatePairsQueryDto> = {},
): WearRatePairsQueryDto {
  return Object.assign(new WearRatePairsQueryDto(), overrides);
}

function crearBrakeDiscRulesFake(
  umbrales = UMBRALES_POR_DEFECTO,
): BrakeDiscRulesService {
  return {
    obtenerUmbrales: jest.fn().mockResolvedValue(umbrales),
    obtenerEvaluador: jest
      .fn()
      .mockResolvedValue(new BrakeDiscRulesEngine(umbrales)),
  } as unknown as BrakeDiscRulesService;
}

// Estos tests solo ejercitan buscarPares, que no toca stats/consensoConfig
// (esos solo los usan obtenerChart/obtenerChartPorTipoCoche) — se pasan como
// stubs vacíos únicamente para satisfacer la firma del constructor.
function servicio(
  prisma: PrismaService,
  brakeDiscRules: BrakeDiscRulesService = crearBrakeDiscRulesFake(),
): WearRateService {
  return new WearRateService(
    prisma,
    new WearRateCalculatorService(),
    brakeDiscRules,
    {} as TraceabilityStatsService,
    {} as ConsensoConfigService,
  );
}

describe('WearRateService.buscarPares — filtros', () => {
  it('modo AND: tipoCoche=MA1 & bogieCodigo=PB3 devuelve solo filas que matcheen AMBOS', async () => {
    const { prisma } = crearPrismaConFixture([
      fila({ id: 'wrp-1', tipoCoche: 'MA1', bogieCodigo: 'PB3' }), // matchea ambos
      fila({ id: 'wrp-2', tipoCoche: 'MA1', bogieCodigo: 'PB2' }), // solo tipoCoche
      fila({ id: 'wrp-3', tipoCoche: 'MB1', bogieCodigo: 'PB3' }), // solo bogie
      fila({ id: 'wrp-4', tipoCoche: 'MB1', bogieCodigo: 'PB2' }), // ninguno
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({
        tipoCoche: ['MA1'],
        bogieCodigo: ['PB3'],
        modoCombinacion: 'AND',
      }),
    );

    expect(resultado.rows.map((r) => r.id)).toEqual(['wrp-1']);
  });

  it('modo OR: motivoFecha2=Reperfilado | soloInvalidos=true devuelve la UNIÓN', async () => {
    const { prisma } = crearPrismaConFixture([
      // Reperfilado pero válido (no debería, pero sirve para probar que
      // matchea por el motivo solo, no por ambos a la vez en modo OR).
      fila({ id: 'wrp-1', motivo2: 'Reperfilado', esValido: true }),
      // Inválido pero motivo Medición.
      fila({ id: 'wrp-2', motivo2: 'Medición', esValido: false }),
      // Ninguno de los dos.
      fila({ id: 'wrp-3', motivo2: 'Medición', esValido: true }),
      // Ambos a la vez -> también debe aparecer en la unión.
      fila({ id: 'wrp-4', motivo2: 'Reperfilado', esValido: false }),
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({
        motivoFecha2: ['Reperfilado'],
        soloInvalidos: true,
        modoCombinacion: 'OR',
      }),
    );

    expect(new Set(resultado.rows.map((r) => r.id))).toEqual(
      new Set(['wrp-1', 'wrp-2', 'wrp-4']),
    );
  });

  it('rango diferenciaRd min/max filtra correctamente', async () => {
    const { prisma } = crearPrismaConFixture([
      fila({ id: 'wrp-1', diferenciaRd: 0.1 }), // debajo del rango
      fila({ id: 'wrp-2', diferenciaRd: 0.5 }), // dentro
      fila({ id: 'wrp-3', diferenciaRd: 0.8 }), // dentro (límite superior)
      fila({ id: 'wrp-4', diferenciaRd: 1.5 }), // encima del rango
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({ diferenciaRdMin: 0.4, diferenciaRdMax: 0.8 }),
    );

    expect(new Set(resultado.rows.map((r) => r.id))).toEqual(
      new Set(['wrp-2', 'wrp-3']),
    );
  });

  it('el response de /wear-rate/pairs incluye la identidad del disco por fila', async () => {
    const { prisma } = crearPrismaConFixture([
      fila({
        id: 'wrp-1',
        tipoCoche: 'MB1',
        numeroCoche: 408,
        bogieCodigo: 'PB6',
        ejeNumero: 3,
        lado: 'derecho',
      }),
    ]);

    const resultado = await servicio(prisma).buscarPares(query());

    expect(resultado.rows[0]).toMatchObject({
      tipoCoche: 'MB1',
      numeroCoche: 408,
      bogieCodigo: 'PB6',
      ejeNumero: 3,
      lado: 'derecho',
    });
  });

  it('sin filtros activos, el WHERE es {} (no filtra nada)', async () => {
    const { prisma, findManyMock } = crearPrismaConFixture([fila()]);

    await servicio(prisma).buscarPares(query());

    const where = findManyMock.mock.calls[0][0].where;
    expect(where).toEqual({});
  });

  it('estado=[CRITICO]: se traduce a rd2<=0 con los umbrales vigentes (no hay columna estadoCalculado)', async () => {
    const { prisma } = crearPrismaConFixture([
      fila({ id: 'wrp-1', rd2: 0 }), // crítico (rd<=0)
      fila({ id: 'wrp-2', rd2: -0.5 }), // crítico
      fila({ id: 'wrp-3', rd2: 0.5 }), // no crítico (Cambio, con umbral 0.4)
      fila({ id: 'wrp-4', rd2: 5 }), // OK
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({ estado: ['CRITICO'] }),
    );

    expect(resultado.rows.map((r) => r.id).sort()).toEqual(['wrp-1', 'wrp-2']);
  });

  it('estado=[OK,CRITICO]: OR entre los rangos de cada estado seleccionado', async () => {
    // rdUmbralOk=1.0, rdUmbralSeguimiento=0.4 (default) -> Cambio y
    // Seguimiento quedan afuera del filtro, solo Crítico y OK entran.
    const { prisma } = crearPrismaConFixture([
      fila({ id: 'critico', rd2: -1 }),
      fila({ id: 'cambio', rd2: 0.2 }),
      fila({ id: 'seguimiento', rd2: 0.7 }),
      fila({ id: 'ok', rd2: 2 }),
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({ estado: ['OK', 'CRITICO'] }),
    );

    expect(resultado.rows.map((r) => r.id).sort()).toEqual(['critico', 'ok']);
  });

  it('estado=[CAMBIO]: rango (0, rdUmbralSeguimiento] — límites estrictos/no estrictos correctos', async () => {
    // rdUmbralSeguimiento=0.4 (default): 0 y -0.5 son Crítico (rd<=0, fuera);
    // 0.4 exacto SÍ es Cambio (límite inclusive); 0.4001 ya es Seguimiento.
    const { prisma } = crearPrismaConFixture([
      fila({ id: 'critico-cero', rd2: 0 }),
      fila({ id: 'cambio-bajo', rd2: 0.1 }),
      fila({ id: 'cambio-limite', rd2: 0.4 }),
      fila({ id: 'seguimiento', rd2: 0.4001 }),
    ]);

    const resultado = await servicio(prisma).buscarPares(
      query({ estado: ['CAMBIO'] }),
    );

    expect(resultado.rows.map((r) => r.id).sort()).toEqual([
      'cambio-bajo',
      'cambio-limite',
    ]);
  });

  it('accionRecomendada=[CRITICO]: filtra por la acción del disco (cruzando discId), pagina sobre lo YA filtrado', async () => {
    const filas = [
      fila({
        id: 'crit-L',
        discId: 'disc-crit-L',
        numeroCoche: 201,
        ejeNumero: 1,
        lado: 'izquierdo',
      }),
      fila({
        id: 'crit-R',
        discId: 'disc-crit-R',
        numeroCoche: 201,
        ejeNumero: 1,
        lado: 'derecho',
      }),
      fila({
        id: 'sano-L',
        discId: 'disc-sano-L',
        numeroCoche: 202,
        ejeNumero: 1,
        lado: 'izquierdo',
      }),
      fila({
        id: 'sano-R',
        discId: 'disc-sano-R',
        numeroCoche: 202,
        ejeNumero: 1,
        lado: 'derecho',
      }),
    ];
    const discos = [
      {
        id: 'disc-crit-L',
        wagonUnitId: 'wu-crit',
        bogieCodigo: 'PB2',
        ejeNumero: 1,
        lado: 'izquierdo',
      },
      {
        id: 'disc-crit-R',
        wagonUnitId: 'wu-crit',
        bogieCodigo: 'PB2',
        ejeNumero: 1,
        lado: 'derecho',
      },
      {
        id: 'disc-sano-L',
        wagonUnitId: 'wu-sano',
        bogieCodigo: 'PB2',
        ejeNumero: 1,
        lado: 'izquierdo',
      },
      {
        id: 'disc-sano-R',
        wagonUnitId: 'wu-sano',
        bogieCodigo: 'PB2',
        ejeNumero: 1,
        lado: 'derecho',
      },
    ];
    const medicionesPorDisco = {
      'disc-crit-L': { hValue: 2.0, rdValue: 0 }, // crítico
      'disc-crit-R': { hValue: 2.0, rdValue: 3.0 },
      'disc-sano-L': { hValue: 0.5, rdValue: 5.0 }, // H bajo -> NINGUNA
      'disc-sano-R': { hValue: 0.5, rdValue: 5.0 },
    };
    const { prisma } = crearPrismaConFixture(filas, discos, medicionesPorDisco);

    const resultado = await servicio(prisma).buscarPares(
      query({ accionRecomendada: ['CRITICO'] }),
    );

    expect(resultado.total).toBe(2);
    expect(resultado.rows.map((r) => r.id).sort()).toEqual([
      'crit-L',
      'crit-R',
    ]);
    // El filtro se usa solo para filtrar, no se filtra el response con un
    // campo accionRecomendada — la fila sigue teniendo la forma normal.
    expect(resultado.rows[0]).not.toHaveProperty('accionRecomendada');
  });
});

describe('WearRateChartQueryDto / WearRateSummaryQueryDto — no exponen los filtros de /pairs', () => {
  it('WearRateChartQueryDto no declara tipoCoche/bogieCodigo/soloInvalidos/rangos', () => {
    const dto = new WearRateChartQueryDto();
    expect('tipoCoche' in dto).toBe(false);
    expect('bogieCodigo' in dto).toBe(false);
    expect('soloInvalidos' in dto).toBe(false);
    expect('diferenciaRdMin' in dto).toBe(false);
  });

  it('WearRateSummaryQueryDto no declara tipoCoche/bogieCodigo/soloInvalidos/rangos', () => {
    const dto = new WearRateSummaryQueryDto();
    expect('tipoCoche' in dto).toBe(false);
    expect('bogieCodigo' in dto).toBe(false);
    expect('soloInvalidos' in dto).toBe(false);
    expect('diferenciaRdMin' in dto).toBe(false);
  });
});

describe('WearRateService.obtenerChart / obtenerSummary — ignoran filtros ajenos', () => {
  it('obtenerChart solo usa `tren` del query, aunque el objeto traiga otros campos', async () => {
    const { prisma, findManyMock } = crearPrismaConFixture([
      fila({ id: 'wrp-1', trenNumero: 6, esValido: true }),
      fila({ id: 'wrp-2', trenNumero: 7, esValido: true }),
    ]);

    // Simula que, por error, llegaran campos de /pairs a esta query (el
    // ValidationPipe global de Nest —whitelist+forbidNonWhitelisted— ya
    // rechaza esto con 400 antes de llegar acá; este test prueba la segunda
    // defensa: aunque llegaran, el servicio nunca los usa para construir el
    // WHERE, solo `tren`).
    const q = {
      tren: 6,
      tipoCoche: ['MA1'],
      soloInvalidos: true,
    } as WearRateChartQueryDto;

    await servicio(prisma).obtenerChart(q);

    const where = findManyMock.mock.calls[0][0].where;
    // fecha2.lt: inicio del mes calendario en curso, siempre agregado por
    // obtenerChart() (excluye el mes todavía sin cerrar — ver
    // WearRateService.inicioMesActualUtc); no es un campo "ajeno" del query.
    const inicioMesActual = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    );
    expect(where).toEqual({ trenNumero: 6, fecha2: { lt: inicioMesActual } });
  });

  // Regresión del refactor a agruparPorMes (apps/api/src/common/agrupar-por-mes.ts,
  // compartido con TraceabilityService) — confirma que agrupar por mes +
  // promediar solo válidos + contar válidos/inválidos sigue funcionando igual.
  it('obtenerChart agrupa por mes, promedia solo los válidos y cuenta ambos', async () => {
    const { prisma } = crearPrismaConFixture([
      fila({
        id: 'wrp-1',
        fecha2: new Date('2024-01-10'),
        tasaMensual: 10,
        esValido: true,
      }),
      fila({
        id: 'wrp-2',
        fecha2: new Date('2024-01-20'),
        tasaMensual: 20,
        esValido: true,
      }),
      fila({
        id: 'wrp-3',
        fecha2: new Date('2024-01-25'),
        tasaMensual: 999,
        esValido: false,
      }),
      fila({
        id: 'wrp-4',
        fecha2: new Date('2024-02-05'),
        tasaMensual: 100,
        esValido: true,
      }),
    ]);

    // tren:6 (mismo trenNumero que fila() usa por defecto): sin filtro de
    // tren, obtenerChart aplica el guard de CONTEO_MINIMO (ver
    // WearRateService.promedioSiSuficiente) y estos 2-3 pares de prueba por
    // mes no lo alcanzan — este test es sobre agruparPorMes/promedio simple,
    // no sobre ese guard (que se prueba aparte).
    const resultado = await servicio(prisma).obtenerChart({
      tren: 6,
    } as WearRateChartQueryDto);

    expect(resultado).toEqual([
      {
        mes: '2024-01',
        tasaMensualPromedio: 15,
        paresValidos: 2,
        paresInvalidos: 1,
      },
      {
        mes: '2024-02',
        tasaMensualPromedio: 100,
        paresValidos: 1,
        paresInvalidos: 0,
      },
    ]);
  });

  it('obtenerSummary solo usa `tren` del query, aunque el objeto traiga otros campos', async () => {
    const { prisma, countMock } = crearPrismaConFixture([
      fila({
        id: 'wrp-1',
        trenNumero: 6,
        esValido: false,
        comentario: 'Motivo de fecha 2 es Cambio',
      }),
    ]);

    const q = { tren: 6, diferenciaRdMin: 0.1 } as WearRateSummaryQueryDto;

    await servicio(prisma).obtenerSummary(q);

    const wheres = countMock.mock.calls.map((c) => c[0].where);
    for (const where of wheres) {
      expect(where).toEqual(expect.objectContaining({ trenNumero: 6 }));
      expect(where).not.toHaveProperty('diferenciaRd');
    }
  });
});
