import { Test } from '@nestjs/testing';
import { utils, write } from 'xlsx';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { SISTEMA_USER_ID } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { construirWorkbookPrueba } from './__fixtures__/construir-workbook-prueba';
import { MigrationService } from './migration.service';

type Registro = Record<string, unknown>;

interface EntradaLog {
  campoEditado: string;
  etapa: string;
  usuarioId: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  scanRecordId: string | null;
  fileId: string;
}

interface PrismaMock {
  uploadedFile: Record<'create', jest.Mock>;
  scanRecord: Record<'createMany', jest.Mock>;
  scanEditLog: Record<'createMany', jest.Mock>;
  $transaction: jest.Mock;
}

function primerArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function archivoPrueba(): Express.Multer.File {
  const buffer = write(construirWorkbookPrueba(), {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer;
  return {
    originalname: 'migracion.xlsx',
    buffer,
  } as Express.Multer.File;
}

// Hoja T06 con 8 filas de datos reales (3-10) y 5 filas fantasma (11-15): sin
// datos identificadores, solo un valor suelto en Kilometraje (formato heredado).
function archivoConFantasmas(): Express.Multer.File {
  const encabezados = [
    'Responsable',
    'Tren',
    'Kilometraje',
    'Fecha',
    'Motivo',
    'Coche',
    'N° Coche',
    'Bogie',
    'Eje',
    'Ubicación',
    'Rueda',
    'H',
    'T',
    'T-H',
    'Comentario',
  ];
  const filaValida = (n: number) => [
    'Ana',
    6,
    100,
    '2024-01-01',
    'Medición',
    'MA1',
    129 + n,
    'PB2',
    1,
    'izquierdo',
    1,
    3.8,
    12.4,
    0,
    'OK',
  ];
  const filaFantasma = () => {
    const f = Array<unknown>(encabezados.length).fill(null);
    f[2] = 0; // valor heredado en columna NO identificadora
    return f;
  };
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
      ['Panel Principal'],
      encabezados,
      ...Array.from({ length: 8 }, (_, i) => filaValida(i)),
      ...Array.from({ length: 5 }, filaFantasma),
    ]),
    'T06',
  );
  const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { originalname: 'con-fantasmas.xlsx', buffer } as Express.Multer.File;
}

describe('MigrationService (upload)', () => {
  let service: MigrationService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      uploadedFile: {
        create: jest.fn().mockResolvedValue({ id: 'file-1' }),
      },
      scanRecord: { createMany: jest.fn().mockResolvedValue({ count: 8 }) },
      scanEditLog: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (arg as (tx: PrismaMock) => unknown)(prisma),
    );

    const brakeDiscRules = {
      obtenerEvaluador: jest
        .fn()
        .mockResolvedValue(new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrakeDiscRulesService, useValue: brakeDiscRules },
      ],
    }).compile();

    service = moduleRef.get(MigrationService);
  });

  it('registra las correcciones automáticas de tren en scan_edit_log (pre_commit, usuario sistema)', async () => {
    await service.procesarUpload(archivoPrueba(), 'admin-1');

    // El fixture tiene 2 filas con tren corregido por hoja: T06 (99->6) y T07 (6->7).
    const entradas = primerArg<{ data: EntradaLog[] }>(
      prisma.scanEditLog.createMany,
    ).data;
    expect(entradas).toHaveLength(2);

    // Todas atribuidas al usuario "sistema", etapa pre_commit, campo trenNumero.
    expect(entradas.every((e) => e.etapa === 'pre_commit')).toBe(true);
    expect(entradas.every((e) => e.usuarioId === SISTEMA_USER_ID)).toBe(true);
    expect(entradas.every((e) => e.campoEditado === 'trenNumero')).toBe(true);
    // Enlazadas al ScanRecord y al archivo creados.
    expect(entradas.every((e) => e.scanRecordId !== null)).toBe(true);
    expect(entradas.every((e) => e.fileId === 'file-1')).toBe(true);

    // Valores: se corrige DESDE el tren del Excel HACIA el tren de la hoja.
    const pares = entradas
      .map((e) => `${e.valorAnterior ?? '?'}->${e.valorNuevo ?? '?'}`)
      .sort();
    expect(pares).toEqual(['6->7', '99->6']);
  });

  it('los id de scan_record enlazados en la auditoría coinciden con los insertados', async () => {
    await service.procesarUpload(archivoPrueba(), 'admin-1');

    const registros = primerArg<{ data: Registro[] }>(
      prisma.scanRecord.createMany,
    ).data;
    const idsInsertados = new Set(registros.map((r) => r.id as string));

    const entradas = primerArg<{ data: EntradaLog[] }>(
      prisma.scanEditLog.createMany,
    ).data;
    for (const e of entradas) {
      expect(idsInsertados.has(e.scanRecordId as string)).toBe(true);
    }
  });

  it('inserta los ScanRecords EN LOTES cuando hay muchas filas (evita el límite de bind-params)', async () => {
    // 1500 filas de datos válidas en una sola hoja => 2 lotes de createMany (1000 + 500).
    const encabezados = [
      'Responsable',
      'Tren',
      'Kilometraje',
      'Fecha',
      'Motivo',
      'Coche',
      'N° Coche',
      'Bogie',
      'Eje',
      'Ubicación',
      'Rueda',
      'H',
      'T',
      'Comentario',
    ];
    const filas = Array.from({ length: 1500 }, (_, i) => [
      'Ana',
      6,
      100 + i,
      '2024-01-01',
      'Medición',
      'MA1',
      129,
      'PB2',
      1,
      'izquierdo',
      1,
      3.8,
      12.4,
      'OK',
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([encabezados, ...filas]),
      'T06',
    );
    const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const archivo = {
      originalname: 'grande.xlsx',
      buffer,
    } as Express.Multer.File;

    const resumen = await service.procesarUpload(archivo, 'admin-1');

    expect(resumen.filasValidas).toBe(1500);
    // Debe haberse llamado createMany en 2 lotes, no una sola vez con 1500.
    expect(prisma.scanRecord.createMany).toHaveBeenCalledTimes(2);
    const calls = prisma.scanRecord.createMany.mock.calls as {
      data: unknown[];
    }[][];
    expect(calls[0][0].data).toHaveLength(1000);
    expect(calls[1][0].data).toHaveLength(500);
  });

  it('con filas fantasma: responde OK (sin 500), inserta solo las válidas y las reporta como omitidas', async () => {
    // Reproduce el bug del .xlsm real: 8 filas reales + 5 fantasma al final.
    const resumen = await service.procesarUpload(
      archivoConFantasmas(),
      'admin-1',
    );

    expect(resumen.filasValidas).toBe(8);
    expect(resumen.filasVaciasOmitidas).toBe(5);
    expect(resumen.filasInvalidas).toHaveLength(0);
    expect(resumen.totalFilasLeidas).toBe(13);

    // Solo se insertan las 8 filas reales (nunca las fantasma).
    const registros = primerArg<{ data: Registro[] }>(
      prisma.scanRecord.createMany,
    ).data;
    expect(registros).toHaveLength(8);

    // Los conteos del UploadedFile reflejan lo mismo.
    const file = primerArg<{ data: Registro }>(prisma.uploadedFile.create).data;
    expect(file.totalRows).toBe(13);
    expect(file.validRows).toBe(8);
    expect(file.invalidRows).toBe(0);
  });
});
