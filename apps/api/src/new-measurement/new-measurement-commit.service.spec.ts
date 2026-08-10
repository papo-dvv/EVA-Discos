import { UnprocessableEntityException } from '@nestjs/common';
import { NewMeasurementCommitService } from './new-measurement-commit.service';

interface FakeFicha {
  id: string;
  uploadedFileId: string | null;
  trenNumero: number;
  responsableMantenimientoNombre: string | null;
  tablaBloqueada: boolean;
}

interface FakeFile {
  id: string;
  tipoCarga: string;
  status: string;
}

interface FakeScanRecord {
  id: string;
  fileId: string;
  discId: string | null;
  responsableNombre: string;
  cocheExcel: string | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  excluidaDelCommit: boolean;
}

// Fake de PrismaService con estado en memoria real (mismo patrón que
// migration-commit.service.spec.ts): permite verificar efectos de las
// escrituras (status, discId) sin levantar una base de datos real.
function crearEntorno(
  overrides: {
    ficha?: Partial<FakeFicha>;
    file?: Partial<FakeFile>;
    scanRecords?: FakeScanRecord[];
  } = {},
) {
  const ficha: FakeFicha = {
    id: 'ficha-1',
    uploadedFileId: 'file-1',
    trenNumero: 32,
    responsableMantenimientoNombre: 'Juan Pérez',
    tablaBloqueada: true,
    ...overrides.ficha,
  };
  const file: FakeFile = {
    id: 'file-1',
    tipoCarga: 'ficha_medicion_individual',
    status: 'review',
    ...overrides.file,
  };
  let scanRecords: FakeScanRecord[] = overrides.scanRecords ?? [
    {
      id: 'sr-1',
      fileId: 'file-1',
      discId: null,
      responsableNombre: '',
      cocheExcel: 'MA1',
      bogieExcel: 'PB3',
      ejeExcel: 1,
      ubicacionExcel: 'izquierdo',
      excluidaDelCommit: false,
    },
  ];
  const tren = { id: 'tren-32', numero: 32 };
  const wagon = {
    id: 'wagon-ma1',
    trenId: 'tren-32',
    tipoCoche: 'MA1',
    numeroCoche: 201,
  };
  const disco = {
    id: 'disco-1',
    wagonUnitId: 'wagon-ma1',
    bogieCodigo: 'PB3',
    ejeNumero: 1,
    lado: 'izquierdo',
  };
  const scanEditLogs: unknown[] = [];

  const base = {
    measurementSheet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === ficha.id ? { ...ficha } : null),
      ),
      delete: jest.fn(() => Promise.resolve(ficha)),
    },
    uploadedFile: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === file.id ? { ...file } : null),
      ),
      update: jest.fn(({ data }: { data: Partial<FakeFile> }) => {
        Object.assign(file, data);
        return Promise.resolve({ ...file });
      }),
      delete: jest.fn(() => Promise.resolve(file)),
    },
    scanRecord: {
      findMany: jest.fn(({ where }: { where: { fileId: string } }) =>
        Promise.resolve(scanRecords.filter((r) => r.fileId === where.fileId)),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeScanRecord>;
        }) => {
          scanRecords = scanRecords.map((r) =>
            r.id === where.id ? { ...r, ...data } : r,
          );
          return Promise.resolve(scanRecords.find((r) => r.id === where.id));
        },
      ),
    },
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(where.numero === tren.numero ? tren : null),
      ),
    },
    wagonUnit: {
      findFirst: jest.fn(
        ({ where }: { where: { trenId: string; tipoCoche: string } }) =>
          Promise.resolve(
            where.trenId === wagon.trenId && where.tipoCoche === wagon.tipoCoche
              ? wagon
              : null,
          ),
      ),
    },
    brakeDisc: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            wagonUnitId_bogieCodigo_ejeNumero_lado: {
              wagonUnitId: string;
              bogieCodigo: string;
              ejeNumero: number;
              lado: string;
            };
          };
        }) => {
          const c = where.wagonUnitId_bogieCodigo_ejeNumero_lado;
          const match =
            c.wagonUnitId === disco.wagonUnitId &&
            c.bogieCodigo === disco.bogieCodigo &&
            c.ejeNumero === disco.ejeNumero &&
            c.lado === disco.lado;
          return Promise.resolve(match ? disco : null);
        },
      ),
    },
    scanEditLog: {
      create: jest.fn(({ data }: { data: unknown }) => {
        scanEditLogs.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    ...base,
    $transaction: jest.fn((fn: (tx: typeof base) => Promise<unknown>) =>
      fn(base),
    ),
  };

  return {
    prisma,
    scanRecordsRef: () => scanRecords,
    fileRef: () => file,
    scanEditLogs,
  };
}

describe('NewMeasurementCommitService.confirmar', () => {
  it('rechaza el commit si falta responsable_mantenimiento_nombre', async () => {
    const { prisma } = crearEntorno({
      ficha: { responsableMantenimientoNombre: null },
    });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /responsable/i,
    );
  });

  it('rechaza el commit si responsable_mantenimiento_nombre es solo espacios', async () => {
    const { prisma } = crearEntorno({
      ficha: { responsableMantenimientoNombre: '   ' },
    });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rechaza el commit si tabla_bloqueada=false aunque responsable_mantenimiento_nombre esté lleno', async () => {
    const { prisma } = crearEntorno({
      ficha: { tablaBloqueada: false },
    });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /bloquear la tabla/i,
    );
  });

  it('excluye del commit las filas marcadas excluidaDelCommit=true (siguen sin discId)', async () => {
    const { prisma, scanRecordsRef, fileRef } = crearEntorno({
      scanRecords: [
        {
          id: 'sr-1',
          fileId: 'file-1',
          discId: null,
          responsableNombre: '',
          cocheExcel: 'MA1',
          bogieExcel: 'PB3',
          ejeExcel: 1,
          ubicacionExcel: 'izquierdo',
          excluidaDelCommit: false,
        },
        {
          id: 'sr-2',
          fileId: 'file-1',
          discId: null,
          responsableNombre: '',
          // Identidad rota a propósito: si el commit intentara resolverla
          // igual (bug de no filtrar antes de resolver) esto lanzaría.
          cocheExcel: 'MB3',
          bogieExcel: 'PB6',
          ejeExcel: 9,
          ubicacionExcel: 'izquierdo',
          excluidaDelCommit: true,
        },
      ],
    });
    const wearRate = {
      recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    const resumen = await service.confirmar('ficha-1', 'user-1');

    expect(resumen.discosResueltos).toBe(1);
    expect(fileRef().status).toBe('committed');
    expect(scanRecordsRef().find((r) => r.id === 'sr-1')?.discId).toBe(
      'disco-1',
    );
    const excluida = scanRecordsRef().find((r) => r.id === 'sr-2');
    expect(excluida?.discId).toBeNull();
    expect(excluida?.responsableNombre).toBe('');
  });

  it('acepta el commit con SOLO responsable_mantenimiento_nombre lleno (resto vacío)', async () => {
    const { prisma, scanRecordsRef, fileRef } = crearEntorno();
    const wearRate = {
      recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    const resumen = await service.confirmar('ficha-1', 'user-1');

    expect(resumen.status).toBe('committed');
    expect(resumen.totalFilas).toBe(1);
    expect(resumen.discosResueltos).toBe(1);
    expect(fileRef().status).toBe('committed');
    expect(scanRecordsRef()[0].discId).toBe('disco-1');
    // Regresión: responsableNombre se crea vacío en las filas (ver
    // NewMeasurementService.aScanRecordData) y solo se conoce el valor final
    // al confirmar — la vista de confirmados (Mediciones) mostraba el
    // Responsable en blanco antes de este fix.
    expect(scanRecordsRef()[0].responsableNombre).toBe('Juan Pérez');
    expect(wearRate.recalcularParaDiscos).toHaveBeenCalled();
  });

  it('rechaza si la ficha no tiene mediciones', async () => {
    const { prisma } = crearEntorno({ scanRecords: [] });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rechaza si la ficha ya fue confirmada', async () => {
    const { prisma } = crearEntorno({ file: { status: 'committed' } });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /ya fue confirmada/i,
    );
  });
});
