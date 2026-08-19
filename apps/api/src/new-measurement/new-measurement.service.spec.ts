import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { NewMeasurementService } from './new-measurement.service';

// Fixture CSV con 2 discos (eje 1 izquierdo, eje 2 derecho) del tren 32 —
// alcanza para ejercitar la comparación disco por disco de
// buscarDuplicadoExacto sin necesitar los 48 discos reales.
function csvFixture(fecha = '20260115'): string {
  return [
    'MeasPlan.Name;Plan de prueba',
    'ID_del_tren;32',
    'Kilometraje;125000',
    'MeasObject.Name;MeasPoint.Name;Dimension.Name;Dimension.Value;Dimension.Unit;Meas.Date;Meas.Time;ProfileLink',
    `Ma1;disco_freno_1_izquierdo;H;2.000;mm;${fecha};093000;link1`,
    `Ma1;disco_freno_1_izquierdo;T;10.000;mm;${fecha};093000;link1`,
    `Ma1;disco_freno_2_derecho;H;2.500;mm;${fecha};094000;link2`,
    `Ma1;disco_freno_2_derecho;T;11.000;mm;${fecha};094000;link2`,
  ].join('\r\n');
}

function archivoFixture(fecha?: string) {
  return {
    originalname: 'medicion.csv',
    buffer: Buffer.from(csvFixture(fecha), 'utf-8'),
  } as Express.Multer.File;
}

interface FakeFichaConfirmada {
  id: string;
  uploadedFileId: string;
  trenNumero: number;
  kilometraje: number;
  fechaFicha: Date;
  createdAt: Date;
}

interface FakeScanRecordConfirmado {
  id: string;
  fileId: string;
  ejeExcel: number;
  ubicacionExcel: string;
  tValue: number;
  hValue: number;
}

// Fake de PrismaService con estado en memoria (mismo patrón que el resto del
// módulo — ver new-measurement-commit.service.spec.ts): sin ficha confirmada
// previa por defecto, así los tests que no la necesitan no tienen que
// pasarla explícitamente.
function crearEntorno(
  opts: {
    fichaConfirmada?: FakeFichaConfirmada | null;
    scanRecordsConfirmados?: FakeScanRecordConfirmado[];
  } = {},
) {
  const tren = { id: 'tren-32', numero: 32, modelo: 'alstom_metropolis9000' };
  const wagon = {
    id: 'wagon-ma1',
    trenId: 'tren-32',
    tipoCoche: 'MA1',
    numeroCoche: 201,
  };
  const fichaConfirmada = opts.fichaConfirmada ?? null;
  const scanRecordsConfirmados = opts.scanRecordsConfirmados ?? [];

  let fichaSeq = 0;
  const fichasCreadas: Record<string, unknown>[] = [];
  const scanRecordsCreados: Record<string, unknown>[] = [];

  const base = {
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(where.numero === tren.numero ? tren : null),
      ),
    },
    wagonUnit: {
      findMany: jest.fn(() => Promise.resolve([wagon])),
    },
    measurementSheet: {
      findFirst: jest.fn(({ where }: { where: { trenNumero: number } }) =>
        Promise.resolve(
          fichaConfirmada && fichaConfirmada.trenNumero === where.trenNumero
            ? fichaConfirmada
            : null,
        ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const nueva = { id: `ficha-nueva-${++fichaSeq}`, ...data };
        fichasCreadas.push(nueva);
        return Promise.resolve(nueva);
      }),
    },
    uploadedFile: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'file-nuevo-1', ...data }),
      ),
    },
    scanRecord: {
      findMany: jest.fn(({ where }: { where: { fileId: string } }) =>
        Promise.resolve(
          scanRecordsConfirmados.filter((r) => r.fileId === where.fileId),
        ),
      ),
      createMany: jest.fn(({ data }: { data: Record<string, unknown>[] }) => {
        scanRecordsCreados.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    measurementSheetTecnico: {
      createMany: jest.fn(() => Promise.resolve({ count: 4 })),
    },
    measurementSheetInstrumento: {
      createMany: jest.fn(() => Promise.resolve({ count: 3 })),
    },
  };

  const prisma = {
    ...base,
    $transaction: jest.fn((fn: (tx: typeof base) => Promise<unknown>) =>
      fn(base),
    ),
  };

  return { prisma, fichasCreadas, scanRecordsCreados };
}

function crearServicio(
  prisma: unknown,
  overrides: { recalcularFlags?: jest.Mock } = {},
) {
  const brakeDiscRules = {
    obtenerEvaluador: jest
      .fn()
      .mockResolvedValue(new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO)),
  };
  const validationService = {
    recalcularFlags:
      overrides.recalcularFlags ?? jest.fn().mockResolvedValue([]),
  };
  // Ningún test de este archivo verifica el contenido de los eventos de
  // historial ni ejercita el camino de "duplicado tras reinicio" (ver
  // buscarUltimoEventoDeTren, siempre undefined acá) — solo que el servicio
  // no explote al intentar registrarlos/consultarlos.
  const history = {
    registrar: jest.fn(),
    listar: jest.fn(),
    buscarUltimoEventoDeTren: jest.fn(),
  };
  return new NewMeasurementService(
    prisma as never,
    brakeDiscRules as never,
    validationService as never,
    history as never,
  );
}

describe('NewMeasurementService.subirCsv — detección de duplicado exacto', () => {
  const fichaConfirmadaBase: FakeFichaConfirmada = {
    id: 'ficha-confirmada-1',
    uploadedFileId: 'file-confirmado',
    trenNumero: 32,
    kilometraje: 125000,
    fechaFicha: new Date(Date.UTC(2026, 0, 15)),
    createdAt: new Date('2026-01-16'),
  };
  const scanRecordsConfirmadosBase: FakeScanRecordConfirmado[] = [
    {
      id: 'sr-conf-1',
      fileId: 'file-confirmado',
      ejeExcel: 1,
      ubicacionExcel: 'izquierdo',
      tValue: 10,
      hValue: 2,
    },
    {
      id: 'sr-conf-2',
      fileId: 'file-confirmado',
      ejeExcel: 2,
      ubicacionExcel: 'derecho',
      tValue: 11,
      hValue: 2.5,
    },
  ];

  it('CSV idéntico (fecha+km+todos los H/T) a la última ficha confirmada del mismo tren dispara duplicadoDetectado=true sin crear la ficha', async () => {
    const { prisma, fichasCreadas } = crearEntorno({
      fichaConfirmada: fichaConfirmadaBase,
      scanRecordsConfirmados: scanRecordsConfirmadosBase,
    });
    const service = crearServicio(prisma);

    const resultado = await service.subirCsv(archivoFixture(), {}, 'user-1');

    expect(resultado).toEqual({
      duplicadoDetectado: true,
      fichaConfirmadaId: 'ficha-confirmada-1',
      fecha: '2026-01-15',
      kilometraje: 125000,
      tren: 32,
      origen: 'confirmada',
    });
    expect(fichasCreadas).toHaveLength(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('CSV con fecha distinta (aunque el resto coincida) no dispara duplicado', async () => {
    const { prisma, fichasCreadas } = crearEntorno({
      fichaConfirmada: {
        ...fichaConfirmadaBase,
        fechaFicha: new Date(Date.UTC(2026, 0, 10)), // 10, no 15
      },
      scanRecordsConfirmados: scanRecordsConfirmadosBase,
    });
    const service = crearServicio(prisma);

    const resultado = await service.subirCsv(
      archivoFixture(), // fecha CSV: 15
      {},
      'user-1',
    );

    expect('duplicadoDetectado' in resultado).toBe(false);
    expect(fichasCreadas).toHaveLength(1);
  });

  it('CSV con un H/T de un disco distinto al confirmado no dispara duplicado', async () => {
    const { prisma, fichasCreadas } = crearEntorno({
      fichaConfirmada: fichaConfirmadaBase,
      scanRecordsConfirmados: [
        scanRecordsConfirmadosBase[0],
        { ...scanRecordsConfirmadosBase[1], tValue: 99 }, // distinto al CSV (11)
      ],
    });
    const service = crearServicio(prisma);

    const resultado = await service.subirCsv(archivoFixture(), {}, 'user-1');

    expect('duplicadoDetectado' in resultado).toBe(false);
    expect(fichasCreadas).toHaveLength(1);
  });

  it('sin ficha confirmada previa del tren, no dispara duplicado y crea la ficha normalmente', async () => {
    const { prisma, fichasCreadas } = crearEntorno();
    const service = crearServicio(prisma);

    const resultado = await service.subirCsv(archivoFixture(), {}, 'user-1');

    expect('duplicadoDetectado' in resultado).toBe(false);
    expect(fichasCreadas).toHaveLength(1);
  });

  // No existe ningún endpoint/parámetro para forzar la carga de un duplicado
  // exacto (el antiguo forzar=true de UploadCsvDto se eliminó por completo):
  // un mismo archivo idéntico al último confirmado nunca crea la ficha, sin
  // importar cuántas veces se reintente subirlo.
  it('un duplicado exacto nunca crea la ficha, ni siquiera reintentando la misma subida', async () => {
    const { prisma, fichasCreadas } = crearEntorno({
      fichaConfirmada: fichaConfirmadaBase,
      scanRecordsConfirmados: scanRecordsConfirmadosBase,
    });
    const service = crearServicio(prisma);

    const primerIntento = await service.subirCsv(
      archivoFixture(),
      {},
      'user-1',
    );
    const segundoIntento = await service.subirCsv(
      archivoFixture(),
      {},
      'user-1',
    );

    expect(primerIntento).toEqual({
      duplicadoDetectado: true,
      fichaConfirmadaId: 'ficha-confirmada-1',
      fecha: '2026-01-15',
      kilometraje: 125000,
      tren: 32,
      origen: 'confirmada',
    });
    expect(segundoIntento).toEqual(primerIntento);
    expect(fichasCreadas).toHaveLength(0);
  });
});
