import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { PrismaService } from '../prisma/prisma.service';
import { MigrationPreviewService } from './migration-preview.service';

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
    | 'count'
    | 'findMany'
    | 'findFirst'
    | 'update'
    | 'delete'
    | 'deleteMany'
    | 'groupBy',
    jest.Mock
  >;
  scanEditLog: Record<'create' | 'createMany', jest.Mock>;
  uploadedFile: Record<'findUnique' | 'update', jest.Mock>;
  $transaction: jest.Mock;
}

// Lee tipado el primer argumento de la primera llamada a un mock.
function primerArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function buildRecord(overrides: Registro = {}): Registro {
  return {
    id: 'row-1',
    fileId: 'file-1',
    discId: null,
    responsableNombre: 'Juan Pérez',
    trenNumero: 6,
    kilometraje: 125000.5,
    fecha: new Date('2024-01-15T00:00:00.000Z'),
    motivo: 'Medición',
    tValue: 12.4,
    hValue: 3.8,
    rdValue: 8.6,
    estadoCalculado: 'OK',
    estadoSugeridoExcel: 'OK',
    corregidoPorHoja: false,
    trenOriginalExcel: null,
    discrepanciaEstadoExcel: false,
    hojaExcelOrigen: 'T06',
    cocheExcel: 'MA1',
    numeroCocheExcel: 129,
    bogieExcel: 'PB2',
    ejeExcel: 1,
    ubicacionExcel: 'izquierdo',
    ruedaExcel: 1,
    ...overrides,
  };
}

describe('MigrationPreviewService', () => {
  let service: MigrationPreviewService;
  let prisma: PrismaMock;
  let brakeDiscRules: { obtenerEvaluador: jest.Mock };

  beforeEach(async () => {
    prisma = {
      scanRecord: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
      },
      scanEditLog: { create: jest.fn(), createMany: jest.fn() },
      uploadedFile: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    // Soporta las dos formas: array (lote de lecturas) y callback (escrituras).
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: PrismaMock) => unknown)(prisma),
    );
    // Por defecto, el archivo existe, es de migración y está en revisión.
    prisma.uploadedFile.findUnique.mockResolvedValue({
      id: 'file-1',
      tipoCarga: 'migracion_masiva_excel',
      status: 'review',
    });

    brakeDiscRules = {
      obtenerEvaluador: jest
        .fn()
        .mockResolvedValue(new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MigrationPreviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrakeDiscRulesService, useValue: brakeDiscRules },
      ],
    }).compile();

    service = moduleRef.get(MigrationPreviewService);
  });

  describe('obtenerPreview', () => {
    it('arma where (tren + search), orderBy mapeado, paginación y totalPages', async () => {
      prisma.scanRecord.count.mockResolvedValue(23);
      prisma.scanRecord.findMany.mockResolvedValue([buildRecord()]);

      const res = await service.obtenerPreview('file-1', {
        tren: 15,
        page: 2,
        pageSize: 10,
        search: 'ana',
        sortBy: 'estado',
        sortDir: 'desc',
      });

      // El fileId queda ANDeado aparte; tren y search van como condiciones
      // combinadas (modo AND por defecto).
      expect(prisma.scanRecord.findMany).toHaveBeenCalledWith({
        where: {
          fileId: 'file-1',
          AND: [
            { trenNumero: 15 },
            {
              OR: [
                { responsableNombre: { contains: 'ana', mode: 'insensitive' } },
                { motivo: { contains: 'ana', mode: 'insensitive' } },
                { cocheExcel: { contains: 'ana', mode: 'insensitive' } },
                { bogieExcel: { contains: 'ana', mode: 'insensitive' } },
                { ubicacionExcel: { contains: 'ana', mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: [{ estadoCalculado: 'desc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      });
      expect(res.total).toBe(23);
      expect(res.totalPages).toBe(3);
      expect(res.totalPaginas).toBe(3);
      expect(res.rows[0].kilometraje).toBe(125000.5);
      expect(res.rows[0].fecha).toBe('2024-01-15');
    });

    it('sin tren ni search, no agrega filtros extra', async () => {
      prisma.scanRecord.count.mockResolvedValue(0);
      prisma.scanRecord.findMany.mockResolvedValue([]);

      await service.obtenerPreview('file-1', {
        page: 1,
        pageSize: 25,
        sortBy: 'fecha',
        sortDir: 'asc',
      });

      const args = primerArg<{ where: unknown; orderBy: unknown }>(
        prisma.scanRecord.findMany,
      );
      expect(args.where).toEqual({ fileId: 'file-1' });
      expect(args.orderBy).toEqual([{ fecha: 'asc' }, { id: 'asc' }]);
    });

    it('lanza NotFound si el archivo no es una carga de migración', async () => {
      prisma.uploadedFile.findUnique.mockResolvedValue({
        id: 'file-1',
        tipoCarga: 'csv_individual',
        status: 'review',
      });

      await expect(
        service.obtenerPreview('file-1', {
          page: 1,
          pageSize: 25,
          sortBy: 'fecha',
          sortDir: 'asc',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('accionRecomendada=[CRITICO]: filtra por la acción calculada del EJE, con paginación sobre lo YA filtrado (no sobre count() de la BD)', async () => {
      // 3 ejes en el borrador: crítico (rd<=0 en un lado), reperfilado
      // (viable en ambos lados) y sin acción (H bajo) — mismo mock de
      // findMany sirve para el fetch sin paginar Y para el cruce interno de
      // enriquecerAccionRecomendadaDraft (no evalúa el WHERE, así que ambas
      // llamadas ven el conjunto completo).
      const filas = [
        buildRecord({
          id: 'critico-L',
          numeroCocheExcel: 201,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'izquierdo',
          ruedaExcel: 1,
          hValue: 2.0,
          rdValue: 0,
        }),
        buildRecord({
          id: 'critico-R',
          numeroCocheExcel: 201,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'derecho',
          ruedaExcel: 2,
          hValue: 2.0,
          rdValue: 3.0,
        }),
        buildRecord({
          id: 'reperf-L',
          numeroCocheExcel: 202,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'izquierdo',
          ruedaExcel: 1,
          hValue: 2.0,
          rdValue: 1.5,
        }),
        buildRecord({
          id: 'reperf-R',
          numeroCocheExcel: 202,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'derecho',
          ruedaExcel: 2,
          hValue: 2.0,
          rdValue: 1.5,
        }),
        buildRecord({
          id: 'ninguna-L',
          numeroCocheExcel: 203,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'izquierdo',
          ruedaExcel: 1,
          hValue: 0.5,
          rdValue: 5.0,
        }),
        buildRecord({
          id: 'ninguna-R',
          numeroCocheExcel: 203,
          bogieExcel: 'PB2',
          ejeExcel: 1,
          ubicacionExcel: 'derecho',
          ruedaExcel: 2,
          hValue: 0.5,
          rdValue: 5.0,
        }),
      ];
      prisma.scanRecord.findMany.mockResolvedValue(filas);

      const res = await service.obtenerPreview('file-1', {
        page: 1,
        pageSize: 25,
        sortBy: 'fecha',
        sortDir: 'asc',
        accionRecomendada: ['CRITICO'],
      });

      expect(res.total).toBe(2);
      expect(res.totalPages).toBe(1);
      expect(res.rows.map((r) => r.id).sort()).toEqual([
        'critico-L',
        'critico-R',
      ]);
      expect(res.rows.every((r) => r.accionRecomendada === 'CRITICO')).toBe(
        true,
      );
      // count() de la base NUNCA se usa en esta rama (el total viene del
      // conjunto filtrado en memoria, no de un COUNT WHERE).
      expect(prisma.scanRecord.count).not.toHaveBeenCalled();
    });
  });

  describe('filtros combinables', () => {
    // Base común: los filtros llegan ya parseados (como los deja el DTO).
    const filtros = {
      page: 1,
      pageSize: 25,
      sortBy: 'fecha' as const,
      sortDir: 'asc' as const,
    };

    function whereDeFindMany(): {
      fileId: string;
      AND?: unknown[];
      OR?: unknown[];
    } {
      return primerArg<{
        where: { fileId: string; AND?: unknown[]; OR?: unknown[] };
      }>(prisma.scanRecord.findMany).where;
    }

    beforeEach(() => {
      prisma.scanRecord.count.mockResolvedValue(0);
      prisma.scanRecord.findMany.mockResolvedValue([]);
    });

    it('modo AND: los 3 filtros activos van juntos en una cláusula AND', async () => {
      await service.obtenerPreview('file-1', {
        ...filtros,
        modoCombinacion: 'AND',
        tipoCoche: ['MA1'],
        estado: ['CRITICO'],
        rdMin: 0,
        rdMax: 0.4,
      });

      const where = whereDeFindMany();
      expect(where.fileId).toBe('file-1'); // fileId siempre ANDeado aparte
      expect(where.OR).toBeUndefined();
      expect(where.AND).toEqual([
        { cocheExcel: { in: ['MA1'] } },
        { estadoCalculado: { in: ['CRITICO'] } },
        { rdValue: { gte: 0, lte: 0.4 } },
      ]);
    });

    it('modo OR: los mismos 3 filtros van dentro de un único OR', async () => {
      await service.obtenerPreview('file-1', {
        ...filtros,
        modoCombinacion: 'OR',
        tipoCoche: ['MA1'],
        estado: ['CRITICO'],
        rdMin: 0,
        rdMax: 0.4,
      });

      const where = whereDeFindMany();
      expect(where.fileId).toBe('file-1');
      expect(where.AND).toBeUndefined();
      expect(where.OR).toEqual([
        { cocheExcel: { in: ['MA1'] } },
        { estadoCalculado: { in: ['CRITICO'] } },
        { rdValue: { gte: 0, lte: 0.4 } },
      ]);
    });

    it('corregidoOAdvertencia=true: matchea filas con CUALQUIERA de los dos flags (OR interno)', async () => {
      await service.obtenerPreview('file-1', {
        ...filtros,
        corregidoOAdvertencia: true,
      });

      const where = whereDeFindMany();
      // Una sola condición, un OR de ambos flags: una fila con solo uno en true
      // igual matchea.
      expect(where.AND).toEqual([
        { OR: [{ corregidoPorHoja: true }, { discrepanciaEstadoExcel: true }] },
      ]);
    });

    it('corregidoOAdvertencia=false: exige ambos flags en false (fila "limpia")', async () => {
      await service.obtenerPreview('file-1', {
        ...filtros,
        corregidoOAdvertencia: false,
      });

      const where = whereDeFindMany();
      expect(where.AND).toEqual([
        { corregidoPorHoja: false, discrepanciaEstadoExcel: false },
      ]);
    });

    it('solo min o solo max en un rango produce {gte} o {lte} sin el otro extremo', async () => {
      await service.obtenerPreview('file-1', {
        ...filtros,
        kilometrajeMin: 100,
      });
      expect(whereDeFindMany().AND).toEqual([{ kilometraje: { gte: 100 } }]);
    });
  });

  describe('obtenerStats', () => {
    it('cuenta por estado el total y el subconjunto filtrado, y totalFilasSubidas sin filtro', async () => {
      // Primer groupBy: total (todos). Segundo: filtrado.
      prisma.scanRecord.groupBy
        .mockResolvedValueOnce([
          { estadoCalculado: 'OK', _count: { _all: 10 } },
          { estadoCalculado: 'SEGUIMIENTO', _count: { _all: 4 } },
          { estadoCalculado: 'CAMBIO', _count: { _all: 2 } },
          { estadoCalculado: 'CRITICO', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { estadoCalculado: 'CRITICO', _count: { _all: 1 } },
        ]);
      prisma.scanRecord.count.mockResolvedValue(17);

      const stats = await service.obtenerStats('file-1', {
        page: 1,
        pageSize: 25,
        sortBy: 'fecha',
        sortDir: 'asc',
        modoCombinacion: 'AND',
        estado: ['CRITICO'],
      });

      // totalFilasSubidas SIEMPRE cuenta toda la carga (fileId a secas), sin
      // importar el filtro vigente.
      expect(prisma.scanRecord.count).toHaveBeenCalledWith({
        where: { fileId: 'file-1' },
      });
      expect(stats.totalFilasSubidas).toBe(17);

      expect(stats.total).toEqual({
        ok: 10,
        seguimiento: 4,
        cambio: 2,
        critico: 1,
      });
      expect(stats.filtrado).toEqual({
        ok: 0,
        seguimiento: 0,
        cambio: 0,
        critico: 1,
      });

      // El total NO lleva filtros; el filtrado sí (estado CRITICO).
      const llamadas = prisma.scanRecord.groupBy.mock.calls as {
        where: { fileId?: string; AND?: unknown[] };
      }[][];
      expect(llamadas[0][0].where).toEqual({ fileId: 'file-1' });
      expect(llamadas[1][0].where.AND).toEqual([
        { estadoCalculado: { in: ['CRITICO'] } },
      ]);
    });

    it('sin filtros, total y filtrado coinciden', async () => {
      prisma.scanRecord.groupBy.mockResolvedValue([
        { estadoCalculado: 'OK', _count: { _all: 3 } },
      ]);
      prisma.scanRecord.count.mockResolvedValue(3);

      const stats = await service.obtenerStats('file-1', {
        page: 1,
        pageSize: 25,
        sortBy: 'fecha',
        sortDir: 'asc',
        modoCombinacion: 'AND',
      });

      expect(stats.total).toEqual(stats.filtrado);
      expect(stats.total.ok).toBe(3);
      expect(stats.totalFilasSubidas).toBe(3);
    });
  });

  describe('obtenerOpcionesFiltro', () => {
    it('devuelve los valores distintos de coche y bogie de la carga', async () => {
      prisma.scanRecord.findMany
        .mockResolvedValueOnce([{ cocheExcel: 'MA1' }, { cocheExcel: 'MB1' }])
        .mockResolvedValueOnce([{ bogieExcel: 'PB1' }, { bogieExcel: 'PB2' }]);

      const res = await service.obtenerOpcionesFiltro('file-1');

      expect(res).toEqual({
        tiposCoche: ['MA1', 'MB1'],
        bogies: ['PB1', 'PB2'],
      });
    });
  });

  describe('obtenerResumenPorTren', () => {
    it('combina conteo total y de advertencias por tren', async () => {
      prisma.scanRecord.groupBy
        .mockResolvedValueOnce([
          { trenNumero: 7, _count: { _all: 2 } },
          { trenNumero: 6, _count: { _all: 5 } },
        ])
        .mockResolvedValueOnce([{ trenNumero: 6, _count: { _all: 2 } }]);

      const res = await service.obtenerResumenPorTren('file-1');

      expect(res).toEqual([
        { tren: 6, totalFilas: 5, filasConAdvertencia: 2 },
        { tren: 7, totalFilas: 2, filasConAdvertencia: 0 },
      ]);
    });
  });

  describe('editarFila', () => {
    it('recalcula rd/estado al cambiar H y audita los campos que cambiaron', async () => {
      const original = buildRecord();
      prisma.scanRecord.findFirst.mockResolvedValue(original);
      prisma.scanRecord.update.mockImplementation(
        (args: { data: Registro }) => ({
          ...original,
          ...args.data,
        }),
      );

      // H 3.8 -> 12.2 con T 12.4  =>  rd = 0.2  =>  CAMBIO
      const res = await service.editarFila(
        'file-1',
        'row-1',
        { hValue: 12.2 },
        'admin-1',
      );

      const dataUpd = primerArg<{ data: Registro }>(
        prisma.scanRecord.update,
      ).data;
      expect(dataUpd.hValue).toBe(12.2);
      expect(dataUpd.rdValue as number).toBeCloseTo(0.2);
      expect(dataUpd.estadoCalculado).toBe('CAMBIO');

      const entradas = primerArg<{ data: EntradaLog[] }>(
        prisma.scanEditLog.createMany,
      ).data;
      const campos = entradas.map((e) => e.campoEditado).sort();
      expect(campos).toEqual(['estadoCalculado', 'hValue', 'rdValue']);
      expect(entradas.every((e) => e.etapa === 'pre_commit')).toBe(true);
      expect(entradas.every((e) => e.usuarioId === 'admin-1')).toBe(true);
      expect(res.estadoCalculado).toBe('CAMBIO');
    });

    it('NO recalcula rd/estado si no cambian H ni T', async () => {
      const original = buildRecord();
      prisma.scanRecord.findFirst.mockResolvedValue(original);
      prisma.scanRecord.update.mockImplementation(
        (args: { data: Registro }) => ({
          ...original,
          ...args.data,
        }),
      );

      await service.editarFila(
        'file-1',
        'row-1',
        { responsableNombre: 'Nuevo Nombre' },
        'admin-1',
      );

      const dataUpd = primerArg<{ data: Registro }>(
        prisma.scanRecord.update,
      ).data;
      expect(dataUpd.rdValue).toBeUndefined();
      expect(dataUpd.estadoCalculado).toBeUndefined();
      const entradas = primerArg<{ data: EntradaLog[] }>(
        prisma.scanEditLog.createMany,
      ).data;
      expect(entradas).toHaveLength(1);
      expect(entradas[0].campoEditado).toBe('responsableNombre');
      expect(entradas[0].valorAnterior).toBe('Juan Pérez');
      expect(entradas[0].valorNuevo).toBe('Nuevo Nombre');
    });

    it('no audita un campo enviado con el mismo valor (sin cambio real)', async () => {
      const original = buildRecord();
      prisma.scanRecord.findFirst.mockResolvedValue(original);
      prisma.scanRecord.update.mockImplementation(
        (args: { data: Registro }) => ({
          ...original,
          ...args.data,
        }),
      );

      await service.editarFila(
        'file-1',
        'row-1',
        { motivo: 'Medición' },
        'admin-1',
      );

      expect(prisma.scanEditLog.createMany).not.toHaveBeenCalled();
    });

    it('lanza NotFound si la fila no existe en la carga', async () => {
      prisma.scanRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.editarFila('file-1', 'row-x', { motivo: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza Conflict si la carga ya no está en revisión', async () => {
      prisma.uploadedFile.findUnique.mockResolvedValue({
        id: 'file-1',
        tipoCarga: 'migracion_masiva_excel',
        status: 'committed',
      });
      await expect(
        service.editarFila('file-1', 'row-1', { motivo: 'X' }, 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('eliminarFila', () => {
    it('crea la auditoría y borra la fila', async () => {
      prisma.scanRecord.findFirst.mockResolvedValue(buildRecord());

      const res = await service.eliminarFila('file-1', 'row-1', 'admin-1');

      const entrada = primerArg<{ data: EntradaLog }>(
        prisma.scanEditLog.create,
      ).data;
      expect(entrada.campoEditado).toBe('fila_eliminada');
      expect(entrada.usuarioId).toBe('admin-1');
      const snapshot = JSON.parse(entrada.valorAnterior ?? '{}') as {
        id: string;
      };
      expect(snapshot.id).toBe('row-1');
      expect(prisma.scanRecord.delete).toHaveBeenCalledWith({
        where: { id: 'row-1' },
      });
      expect(res).toEqual({ eliminadas: 1 });
    });

    it('lanza NotFound si la fila no existe', async () => {
      prisma.scanRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.eliminarFila('file-1', 'row-x', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminarTren', () => {
    it('audita una entrada por fila y borra todas las del tren', async () => {
      prisma.scanRecord.findMany.mockResolvedValue([
        buildRecord({ id: 'r1' }),
        buildRecord({ id: 'r2' }),
        buildRecord({ id: 'r3' }),
      ]);

      const res = await service.eliminarTren('file-1', 6, 'admin-1');

      const entradas = primerArg<{ data: EntradaLog[] }>(
        prisma.scanEditLog.createMany,
      ).data;
      expect(entradas).toHaveLength(3);
      expect(entradas.every((e) => e.campoEditado === 'fila_eliminada')).toBe(
        true,
      );
      expect(prisma.scanRecord.deleteMany).toHaveBeenCalledWith({
        where: { fileId: 'file-1', trenNumero: 6 },
      });
      expect(res).toEqual({ eliminadas: 3 });
    });

    it('lanza NotFound si el tren no tiene filas', async () => {
      prisma.scanRecord.findMany.mockResolvedValue([]);
      await expect(
        service.eliminarTren('file-1', 99, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
