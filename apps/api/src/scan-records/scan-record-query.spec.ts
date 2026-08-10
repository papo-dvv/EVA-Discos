import type { PrismaService } from '../prisma/prisma.service';
import {
  buscarScanRecordsPaginado,
  obtenerValoresDistintosScanRecord,
} from './scan-record-query';

type Registro = Record<string, unknown>;
type Condicion = Record<string, unknown>;

// Mismo patrón que scan-records.service.spec.ts/wear-rate-pairs-query.spec.ts:
// un fake de Prisma que EVALÚA el WHERE contra un array en memoria.
function coincideCampo(valor: unknown, filtro: unknown): boolean {
  if (filtro === null) return valor === null;
  if (typeof filtro !== 'object' || filtro instanceof Date) {
    return valor === filtro;
  }
  const f = filtro as Record<string, unknown>;
  if ('not' in f) return f.not === null ? valor !== null : valor !== f.not;
  if ('in' in f) {
    const opciones = f.in as unknown[];
    if (f.mode === 'insensitive' && typeof valor === 'string') {
      return opciones.some(
        (o) => typeof o === 'string' && o.toLowerCase() === valor.toLowerCase(),
      );
    }
    return opciones.includes(valor);
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

function scan(overrides: Registro = {}): Registro {
  return {
    id: 'row-1',
    fileId: 'file-1',
    discId: null,
    responsableNombre: 'Juan Pérez',
    trenNumero: 6,
    kilometraje: 100000,
    fecha: new Date('2026-01-01T00:00:00.000Z'),
    motivo: 'Medición',
    cocheExcel: 'MA1',
    numeroCocheExcel: 101,
    bogieExcel: 'PB3',
    ejeExcel: 1,
    ruedaExcel: 1,
    ubicacionExcel: 'disco_freno_1_izquierdo',
    hValue: 3.8,
    tValue: 12.4,
    rdValue: 8.6,
    estadoCalculado: 'OK',
    estadoSugeridoExcel: null,
    corregidoPorHoja: false,
    trenOriginalExcel: null,
    discrepanciaEstadoExcel: false,
    hojaExcelOrigen: 'T06',
    ...overrides,
  };
}

function crearPrisma(registros: Registro[]): PrismaService {
  const scanRecord = {
    findMany: jest.fn(
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
    ),
    count: jest.fn(({ where }: { where: Condicion }) =>
      Promise.resolve(
        registros.filter((r) => coincideCondicion(r, where)).length,
      ),
    ),
  };
  return {
    scanRecord,
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  } as unknown as PrismaService;
}

const FILTROS_BASE = {
  page: 1,
  pageSize: 25,
  sortDir: 'asc' as const,
  modoCombinacion: 'AND' as const,
};

describe('buscarScanRecordsPaginado — vistaFecha', () => {
  it("vistaFecha='ultima' devuelve exactamente 1 fila por disc_id, la de fecha más reciente de cada uno", async () => {
    const registros = [
      // disco A (3 mediciones históricas)
      scan({ id: 'a1', discId: 'disco-A', fecha: new Date('2026-01-01') }),
      scan({ id: 'a2', discId: 'disco-A', fecha: new Date('2026-03-01') }), // la más reciente de A
      scan({ id: 'a3', discId: 'disco-A', fecha: new Date('2026-02-01') }),
      // disco B (2 mediciones históricas)
      scan({ id: 'b1', discId: 'disco-B', fecha: new Date('2026-01-15') }),
      scan({ id: 'b2', discId: 'disco-B', fecha: new Date('2026-01-20') }), // la más reciente de B
    ];
    const prisma = crearPrisma(registros);

    const resultado = await buscarScanRecordsPaginado(
      prisma,
      {},
      {
        ...FILTROS_BASE,
        vistaFecha: 'ultima',
      },
    );

    expect(resultado.total).toBe(2);
    expect(resultado.rows).toHaveLength(2);
    // Exactamente 1 fila por disc_id.
    const discIds = resultado.rows.map((r) => r.discId).sort();
    expect(discIds).toEqual(['disco-A', 'disco-B']);
    // Y es la de fecha MÁS RECIENTE de cada uno, no cualquiera.
    const filaA = resultado.rows.find((r) => r.discId === 'disco-A')!;
    const filaB = resultado.rows.find((r) => r.discId === 'disco-B')!;
    expect(filaA.id).toBe('a2');
    expect(filaA.fecha).toBe('2026-03-01');
    expect(filaB.id).toBe('b2');
    expect(filaB.fecha).toBe('2026-01-20');
  });

  it("vistaFecha='primera' devuelve la fila de fecha MÁS ANTIGUA de cada disco", async () => {
    const registros = [
      scan({ id: 'a1', discId: 'disco-A', fecha: new Date('2026-01-01') }), // la más antigua de A
      scan({ id: 'a2', discId: 'disco-A', fecha: new Date('2026-03-01') }),
    ];
    const prisma = crearPrisma(registros);

    const resultado = await buscarScanRecordsPaginado(
      prisma,
      {},
      {
        ...FILTROS_BASE,
        vistaFecha: 'primera',
      },
    );

    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].id).toBe('a1');
  });

  it("vistaFecha='todas' (o ausente) NO colapsa — se mantienen todas las filas históricas", async () => {
    const registros = [
      scan({ id: 'a1', discId: 'disco-A', fecha: new Date('2026-01-01') }),
      scan({ id: 'a2', discId: 'disco-A', fecha: new Date('2026-03-01') }),
    ];
    const prisma = crearPrisma(registros);

    const resultado = await buscarScanRecordsPaginado(
      prisma,
      {},
      {
        ...FILTROS_BASE,
      },
    );

    expect(resultado.total).toBe(2);
  });
});

describe('obtenerValoresDistintosScanRecord', () => {
  it('no duplica strings con distinta capitalización (mismo valor, distinta mayúscula/minúscula cuenta 1 sola vez)', async () => {
    const registros = [
      scan({ id: 'r1', motivo: 'Medición' }),
      scan({ id: 'r2', motivo: 'medición' }),
      scan({ id: 'r3', motivo: 'MEDICIÓN' }),
      scan({ id: 'r4', motivo: 'Reperfilado' }),
    ];
    const prisma = crearPrisma(registros);

    const valores = await obtenerValoresDistintosScanRecord(
      prisma,
      {},
      'motivo',
    );

    // 4 filas, 2 valores distintos SIN distinguir mayúsculas — nunca "Medición"
    // Y "medición" Y "MEDICIÓN" como 3 opciones separadas del dropdown.
    expect(valores).toHaveLength(2);
    expect(valores.map((v) => v.toLowerCase()).sort()).toEqual([
      'medición',
      'reperfilado',
    ]);
  });

  it('responsable también deduplica sin distinguir mayúsculas', async () => {
    const registros = [
      scan({ id: 'r1', responsableNombre: 'Ana Torres' }),
      scan({ id: 'r2', responsableNombre: 'ANA TORRES' }),
      scan({ id: 'r3', responsableNombre: 'Luis Gómez' }),
    ];
    const prisma = crearPrisma(registros);

    const valores = await obtenerValoresDistintosScanRecord(
      prisma,
      {},
      'responsable',
    );

    expect(valores).toHaveLength(2);
  });
});
