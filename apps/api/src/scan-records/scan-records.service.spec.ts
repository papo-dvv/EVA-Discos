import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { PrismaService } from '../prisma/prisma.service';
import { ScanRecordsService } from './scan-records.service';

type Registro = Record<string, unknown>;

interface EntradaLog {
  campoEditado: string;
  etapa: string;
  usuarioId: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
}

interface PrismaMock {
  scanRecord: Record<
    | 'findUnique'
    | 'findFirst'
    | 'update'
    | 'delete'
    | 'findMany'
    | 'count'
    | 'groupBy',
    jest.Mock
  >;
  scanEditLog: Record<'create' | 'createMany', jest.Mock>;
  brakeDisc: Record<'findMany', jest.Mock>;
  $transaction: jest.Mock;
}

function primerArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function scan(overrides: Registro = {}): Registro {
  return {
    id: 'row-1',
    fileId: 'file-1',
    discId: 'disc-1',
    trenNumero: 6,
    responsableNombre: 'Juan Pérez',
    kilometraje: 125000.5,
    fecha: new Date('2024-01-15T00:00:00.000Z'),
    motivo: 'Medición',
    tValue: 12.4,
    hValue: 3.8,
    rdValue: 8.6,
    estadoCalculado: 'OK',
    corregidoPorHoja: false,
    discrepanciaEstadoExcel: false,
    file: { status: 'committed' },
    ...overrides,
  };
}

// --- Fake de Prisma que EVALÚA el WHERE contra un array en memoria (no solo
// registra la llamada): así el test de "solo confirmados" verifica de
// verdad que las filas borrador (discId null) nunca vuelven, en vez de
// únicamente comprobar que se llamó con cierto argumento. ---
type Condicion = Record<string, unknown>;

function coincideCampo(valor: unknown, filtro: unknown): boolean {
  if (filtro === null) return valor === null;
  if (typeof filtro !== 'object' || filtro instanceof Date) {
    return valor === filtro;
  }
  const f = filtro as Record<string, unknown>;
  if ('not' in f) return f.not === null ? valor !== null : valor !== f.not;
  if ('in' in f) return (f.in as unknown[]).includes(valor);
  if ('contains' in f) {
    if (typeof valor !== 'string') return false;
    return valor.toLowerCase().includes(String(f.contains).toLowerCase());
  }
  if ('gte' in f || 'lte' in f) {
    if (valor === null || valor === undefined) return false;
    const num = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));
    const v = num(valor);
    if (f.gte !== undefined && v < num(f.gte)) return false;
    if (f.lte !== undefined && v > num(f.lte)) return false;
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

// Mismo orden que ORDEN_MAS_RECIENTE en accion-recomendada.query.ts: fecha
// desc, kilometraje desc, id desc.
function masRecientePrimero(a: Registro, b: Registro): number {
  const fa = (a.fecha as Date).getTime();
  const fb = (b.fecha as Date).getTime();
  if (fa !== fb) return fb - fa;
  const ka = Number(a.kilometraje);
  const kb = Number(b.kilometraje);
  if (ka !== kb) return kb - ka;
  return (b.id as string).localeCompare(a.id as string);
}

function crearPrismaConFixture(registros: Registro[]): PrismaMock {
  const prisma: PrismaMock = {
    scanRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(({ where }: { where: Condicion }) => {
        const filas = registros
          .filter((r) => coincideCondicion(r, where))
          .sort(masRecientePrimero);
        return Promise.resolve(filas[0] ?? null);
      }),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(
        ({
          where,
          skip,
          take,
          distinct,
        }: {
          where: Condicion;
          skip?: number;
          take?: number;
          distinct?: string[];
        }) => {
          let filas = registros.filter((r) => coincideCondicion(r, where));
          filas = [...filas].sort((a, b) =>
            (a.id as string).localeCompare(b.id as string),
          );
          if (distinct?.length) {
            const vistos = new Set<unknown>();
            filas = filas.filter((r) => {
              const clave = distinct.map((campo) => r[campo]).join('|');
              if (vistos.has(clave)) return false;
              vistos.add(clave);
              return true;
            });
          }
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
      groupBy: jest.fn(({ where, by }: { where: Condicion; by: string[] }) => {
        const campo = by[0];
        const filas = registros.filter((r) => coincideCondicion(r, where));
        const grupos = new Map<unknown, number>();
        for (const r of filas) {
          grupos.set(r[campo], (grupos.get(r[campo]) ?? 0) + 1);
        }
        return Promise.resolve(
          [...grupos.entries()].map(([valor, count]) => ({
            [campo]: valor,
            _count: { _all: count },
          })),
        );
      }),
    },
    scanEditLog: { create: jest.fn(), createMany: jest.fn() },
    // Vacío por defecto: sin catálogo de discos en el fixture, la
    // vista permanente jamás cruza ningún par (accionRecomendada queda
    // null en todas las filas) — ver el describe dedicado más abajo para
    // el caso con discos reales.
    brakeDisc: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: PrismaMock) => unknown)(prisma),
    ),
  };
  return prisma;
}

describe('ScanRecordsService (post-commit)', () => {
  let service: ScanRecordsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = crearPrismaConFixture([]);

    const brakeDiscRules = {
      obtenerEvaluador: jest
        .fn()
        .mockResolvedValue(new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScanRecordsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrakeDiscRulesService, useValue: brakeDiscRules },
      ],
    }).compile();

    service = moduleRef.get(ScanRecordsService);
  });

  describe('editar', () => {
    it('recalcula rd/estado al cambiar H y audita con etapa post_commit', async () => {
      const original = scan();
      prisma.scanRecord.findUnique.mockResolvedValue(original);
      prisma.scanRecord.update.mockImplementation(
        (args: { data: Registro }) => ({ ...original, ...args.data }),
      );

      // H 3.8 -> 12.2 con T 12.4  =>  rd = 0.2  =>  CAMBIO
      await service.editar('row-1', { hValue: 12.2 }, 'admin-1');

      const dataUpd = primerArg<{ data: Registro }>(
        prisma.scanRecord.update,
      ).data;
      expect(dataUpd.rdValue as number).toBeCloseTo(0.2);
      expect(dataUpd.estadoCalculado).toBe('CAMBIO');

      const entradas = primerArg<{ data: EntradaLog[] }>(
        prisma.scanEditLog.createMany,
      ).data;
      const campos = entradas.map((e) => e.campoEditado).sort();
      expect(campos).toEqual(['estadoCalculado', 'hValue', 'rdValue']);
      expect(entradas.every((e) => e.etapa === 'post_commit')).toBe(true);
      expect(entradas.every((e) => e.usuarioId === 'admin-1')).toBe(true);
    });

    it('lanza Conflict si el registro aún no está confirmado (file en review)', async () => {
      prisma.scanRecord.findUnique.mockResolvedValue(
        scan({ file: { status: 'review' } }),
      );
      await expect(
        service.editar('row-1', { motivo: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lanza NotFound si el registro no existe', async () => {
      prisma.scanRecord.findUnique.mockResolvedValue(null);
      await expect(
        service.editar('row-x', { motivo: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminar', () => {
    it('audita con etapa post_commit (snapshot) y borra el registro', async () => {
      prisma.scanRecord.findUnique.mockResolvedValue(scan());

      const res = await service.eliminar('row-1', 'admin-1');

      const entrada = primerArg<{ data: EntradaLog }>(
        prisma.scanEditLog.create,
      ).data;
      expect(entrada.etapa).toBe('post_commit');
      expect(entrada.campoEditado).toBe('fila_eliminada');
      const snapshot = JSON.parse(entrada.valorAnterior ?? '{}') as {
        id: string;
        discId: string;
      };
      expect(snapshot.id).toBe('row-1');
      expect(snapshot.discId).toBe('disc-1');
      expect(prisma.scanRecord.delete).toHaveBeenCalledWith({
        where: { id: 'row-1' },
      });
      expect(res).toEqual({ eliminadas: 1 });
    });
  });

  // Vista permanente de mediciones (este prompt): fixture mezclando filas
  // borrador (discId null, de una migración todavía en review) y confirmadas
  // (discId resuelto) — los 3 endpoints nuevos NUNCA deben devolver las
  // borrador, sin importar de qué migración/tren vengan.
  describe('vista permanente de mediciones confirmadas', () => {
    const filtrosBase = {
      page: 1,
      pageSize: 25,
      sortBy: 'fecha' as const,
      sortDir: 'asc' as const,
      modoCombinacion: 'AND' as const,
    };

    function construirFixtureMixta(): Registro[] {
      return [
        // Tren 6: 2 confirmadas + 1 borrador (misma migración en curso)
        scan({
          id: 'r1',
          discId: 'disc-1',
          trenNumero: 6,
          estadoCalculado: 'OK',
        }),
        scan({
          id: 'r2',
          discId: 'disc-2',
          trenNumero: 6,
          estadoCalculado: 'CRITICO',
        }),
        scan({ id: 'r3', discId: null, trenNumero: 6, estadoCalculado: 'OK' }),
        // Tren 7: 1 confirmada + 2 borrador (otra migración en curso)
        scan({
          id: 'r4',
          discId: 'disc-3',
          trenNumero: 7,
          estadoCalculado: 'SEGUIMIENTO',
        }),
        scan({
          id: 'r5',
          discId: null,
          trenNumero: 7,
          estadoCalculado: 'CRITICO',
        }),
        scan({
          id: 'r6',
          discId: null,
          trenNumero: 7,
          estadoCalculado: 'CRITICO',
        }),
      ];
    }

    it('buscar(): solo devuelve filas con discId resuelto, nunca borradores', async () => {
      prisma = crearPrismaConFixture(construirFixtureMixta());
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.buscar(filtrosBase);

      // 3 confirmadas en total (r1, r2, r4); las 3 borrador (r3, r5, r6) NUNCA
      // aparecen, aunque compartan tren con filas ya confirmadas.
      expect(res.total).toBe(3);
      const ids = res.rows.map((r) => r.id).sort();
      expect(ids).toEqual(['r1', 'r2', 'r4']);
      expect(ids).not.toContain('r3');
      expect(ids).not.toContain('r5');
      expect(ids).not.toContain('r6');
    });

    it('buscar(tren=6): combina el filtro de tren con el scope de confirmados (solo r1, r2)', async () => {
      prisma = crearPrismaConFixture(construirFixtureMixta());
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.buscar({ ...filtrosBase, tren: 6 });

      expect(res.total).toBe(2);
      expect(res.rows.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    });

    it('obtenerResumenPorTren(): cuenta solo confirmadas por tren, ignora las borrador del mismo tren', async () => {
      prisma = crearPrismaConFixture(construirFixtureMixta());
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.obtenerResumenPorTren();

      // Tren 6 tiene 3 filas en total pero solo 2 confirmadas; tren 7 tiene 3
      // en total pero solo 1 confirmada. El resumen refleja SOLO lo confirmado.
      expect(res).toEqual([
        { tren: 6, totalFilas: 2, filasConAdvertencia: 0 },
        { tren: 7, totalFilas: 1, filasConAdvertencia: 0 },
      ]);
    });

    it('obtenerStats(): totalFilasSubidas y conteos por estado excluyen las borrador', async () => {
      prisma = crearPrismaConFixture(construirFixtureMixta());
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const stats = await service.obtenerStats(filtrosBase);

      // 3 confirmadas en total (no 6): r1(OK), r2(CRITICO), r4(SEGUIMIENTO).
      // Las 3 borrador (una CRITICO doble en tren 7) no deben sumar acá.
      expect(stats.totalFilasSubidas).toBe(3);
      expect(stats.total).toEqual({
        ok: 1,
        seguimiento: 1,
        cambio: 0,
        critico: 1,
        reperfilado: 0,
      });
      expect(stats.filtrado).toEqual(stats.total);
    });

    it('obtenerOpcionesFiltro(): valores distintos de coche/bogie SOLO entre confirmadas', async () => {
      prisma = crearPrismaConFixture([
        scan({
          id: 'r1',
          discId: 'disc-1',
          cocheExcel: 'MA1',
          bogieExcel: 'PB2',
        }),
        scan({
          id: 'r2',
          discId: 'disc-2',
          cocheExcel: 'MA1',
          bogieExcel: 'PB6',
        }),
        // Borrador con un coche/bogie que NO existe en ninguna fila confirmada:
        // no debe aparecer en las opciones.
        scan({ id: 'r3', discId: null, cocheExcel: 'REM', bogieExcel: 'TB1' }),
      ]);
      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.obtenerOpcionesFiltro();

      expect(res).toEqual({ tiposCoche: ['MA1'], bogies: ['PB2', 'PB6'] });
    });

    it('buscar(): accionRecomendada/ladoAfectado ya no se calculan (se dejó de invocar evaluarAccionRecomendada) — ni aparecen en la fila', async () => {
      const filas = [scan({ id: 'r1', discId: 'disc-L' })];
      prisma = crearPrismaConFixture(filas);

      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.buscar(filtrosBase);

      expect((res.rows[0] as Registro).accionRecomendada).toBeUndefined();
      expect((res.rows[0] as Registro).ladoAfectado).toBeUndefined();
      // brakeDisc nunca se consulta: sin enriquecimiento, no hace falta
      // resolver el disco par.
      expect(prisma.brakeDisc.findMany).not.toHaveBeenCalled();
    });

    it('buscar(accionRecomendada=[CRITICO]): el filtro se ignora en silencio — sigue paginando en la base como siempre', async () => {
      const filas = [scan({ id: 'r1', discId: 'disc-1' })];
      prisma = crearPrismaConFixture(filas);

      const moduleRef = await Test.createTestingModule({
        providers: [
          ScanRecordsService,
          { provide: PrismaService, useValue: prisma },
          {
            provide: BrakeDiscRulesService,
            useValue: { obtenerEvaluador: jest.fn() },
          },
        ],
      }).compile();
      service = moduleRef.get(ScanRecordsService);

      const res = await service.buscar({
        ...filtrosBase,
        accionRecomendada: ['CRITICO'],
      });

      expect(res.total).toBe(1);
      expect(res.rows.map((r) => r.id)).toEqual(['r1']);
    });
  });
});
