import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NewMeasurementCommitService } from './new-measurement-commit.service';

interface FakeFicha {
  id: string;
  uploadedFileId: string | null;
  trenNumero: number;
  responsableMantenimientoNombre: string | null;
  ptCodigo: string | null;
  tablaBloqueada: boolean;
  verificado: boolean;
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
    ptCodigo: 'PT-001',
    tablaBloqueada: true,
    verificado: true,
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

  let uploadedFileSeq = 0;

  const base = {
    measurementSheet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === ficha.id ? { ...ficha } : null),
      ),
      update: jest.fn(({ data }: { data: Partial<FakeFicha> }) => {
        Object.assign(ficha, data);
        return Promise.resolve({ ...ficha });
      }),
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
      create: jest.fn(({ data }: { data: Partial<FakeFile> }) => {
        const nuevo: FakeFile = {
          id: `file-nuevo-${++uploadedFileSeq}`,
          tipoCarga: 'ficha_medicion_individual',
          status: 'review',
          ...data,
        };
        return Promise.resolve(nuevo);
      }),
    },
    scanRecord: {
      findMany: jest.fn(({ where }: { where: { fileId: string } }) =>
        Promise.resolve(scanRecords.filter((r) => r.fileId === where.fileId)),
      ),
      count: jest.fn(({ where }: { where: { fileId: string } }) =>
        Promise.resolve(
          scanRecords.filter((r) => r.fileId === where.fileId).length,
        ),
      ),
      deleteMany: jest.fn(({ where }: { where: { fileId: string } }) => {
        const antes = scanRecords.length;
        scanRecords = scanRecords.filter((r) => r.fileId !== where.fileId);
        return Promise.resolve({ count: antes - scanRecords.length });
      }),
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
    // Sintetiza un disco físico determinístico por cada combinación eje/lado
    // bajo el único coche sembrado (wagon-ma1) — mismo patrón que
    // new-measurement-validation.service.spec.ts, así un test puede usar más
    // de un eje sin tener que declarar un disco fijo por cada uno. eje1/
    // izquierdo/PB3 conserva el id 'disco-1' de siempre (varios tests ya lo
    // asertan tal cual).
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
          if (c.wagonUnitId !== disco.wagonUnitId) return Promise.resolve(null);
          const id =
            c.bogieCodigo === disco.bogieCodigo &&
            c.ejeNumero === disco.ejeNumero &&
            c.lado === disco.lado
              ? disco.id
              : `disco-eje${c.ejeNumero}-${c.lado}`;
          return Promise.resolve({
            id,
            wagonUnitId: c.wagonUnitId,
            bogieCodigo: c.bogieCodigo,
            ejeNumero: c.ejeNumero,
            lado: c.lado,
          });
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
    fichaRef: () => ficha,
    scanEditLogs,
  };
}

// Mock compartido de NewMeasurementHistoryService — ningún test de este
// archivo verifica el contenido de los eventos de historial, solo que el
// servicio no explote al intentar registrarlos (ver NewMeasurementHistoryService.registrar).
const historyMock = {
  registrar: jest.fn(),
  listar: jest.fn(),
  buscarUltimoEventoDeTren: jest.fn(),
};

describe('NewMeasurementCommitService.confirmar', () => {
  it('rechaza el commit si falta responsable_mantenimiento_nombre', async () => {
    const { prisma } = crearEntorno({
      ficha: { responsableMantenimientoNombre: null },
    });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
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
      historyMock as never,
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
      historyMock as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /bloquear la tabla/i,
    );
  });

  it('rechaza el commit si falta pt_codigo (null) aunque tabla_bloqueada=true y responsable_mantenimiento_nombre lleno', async () => {
    const { prisma } = crearEntorno({ ficha: { ptCodigo: null } });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /P\.T\./,
    );
  });

  it('rechaza el commit si pt_codigo es solo espacios', async () => {
    const { prisma } = crearEntorno({ ficha: { ptCodigo: '   ' } });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('confirma TODAS las filas de la ficha — ya no existe un camino de commit parcial', async () => {
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
        },
        {
          id: 'sr-2',
          fileId: 'file-1',
          discId: null,
          responsableNombre: '',
          cocheExcel: 'MA1',
          bogieExcel: 'PB3',
          ejeExcel: 2,
          ubicacionExcel: 'izquierdo',
        },
      ],
    });
    const wearRate = {
      recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    const resumen = await service.confirmar('ficha-1', 'user-1');

    expect(resumen.totalFilas).toBe(2);
    // Las 2 filas se confirman — nunca menos de las que trae la ficha.
    expect(resumen.discosResueltos).toBe(2);
    expect(fileRef().status).toBe('committed');
    expect(scanRecordsRef().every((r) => r.discId !== null)).toBe(true);
    expect(scanRecordsRef().find((r) => r.id === 'sr-1')?.discId).toBe(
      'disco-1',
    );
    expect(scanRecordsRef().find((r) => r.id === 'sr-2')?.discId).toBe(
      'disco-eje2-izquierdo',
    );
  });

  it('acepta el commit con SOLO responsable_mantenimiento_nombre lleno (resto vacío)', async () => {
    const { prisma, scanRecordsRef, fileRef } = crearEntorno();
    const wearRate = {
      recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
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
      historyMock as never,
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
      historyMock as never,
    );

    await expect(service.confirmar('ficha-1', 'user-1')).rejects.toThrow(
      /ya fue confirmada/i,
    );
  });
});

describe('NewMeasurementCommitService.reiniciar', () => {
  it('elimina los scan_records de la carga anterior y deja la ficha lista para un nuevo upload', async () => {
    const { prisma, scanRecordsRef, fichaRef } = crearEntorno({
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
        },
        {
          id: 'sr-2',
          fileId: 'file-1',
          discId: null,
          responsableNombre: '',
          cocheExcel: 'MA1',
          bogieExcel: 'PB3',
          ejeExcel: 1,
          ubicacionExcel: 'derecho',
        },
      ],
    });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    const resumen = await service.reiniciar('ficha-1', 'user-1');

    expect(resumen.registrosEliminados).toBe(2);
    // Ninguno de los scan_records de la carga anterior sobrevive.
    expect(scanRecordsRef()).toHaveLength(0);
    // Mismo fichaId, NUNCA se crea un measurement_sheet duplicado — reiniciar
    // solo actualiza el registro existente.
    expect(fichaRef().id).toBe('ficha-1');
    expect(fichaRef().uploadedFileId).toBe(resumen.fileId);
    expect(fichaRef().uploadedFileId).not.toBe('file-1');
    expect(fichaRef().verificado).toBe(false);
    expect(fichaRef().tablaBloqueada).toBe(false);
  });

  it('sin scan_records previos, igual crea un archivo técnico nuevo y no falla', async () => {
    const { prisma, fichaRef } = crearEntorno({ scanRecords: [] });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    const resumen = await service.reiniciar('ficha-1', 'user-1');

    expect(resumen.registrosEliminados).toBe(0);
    expect(resumen.fileId).toBeTruthy();
    expect(fichaRef().uploadedFileId).toBe(resumen.fileId);
  });

  it('rechaza si la ficha ya fue confirmada (no se puede reiniciar una ficha committed)', async () => {
    const { prisma } = crearEntorno({ file: { status: 'committed' } });
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    await expect(service.reiniciar('ficha-1', 'user-1')).rejects.toThrow(
      /ya fue confirmada/i,
    );
  });

  it('rechaza si la ficha no existe', async () => {
    const { prisma } = crearEntorno();
    const wearRate = { recalcularParaDiscos: jest.fn() };
    const service = new NewMeasurementCommitService(
      prisma as never,
      wearRate as never,
      historyMock as never,
    );

    await expect(
      service.reiniciar('ficha-inexistente', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
