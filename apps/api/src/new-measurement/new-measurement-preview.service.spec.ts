import { HttpException } from '@nestjs/common';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { NewMeasurementPreviewService } from './new-measurement-preview.service';

interface FakeFicha {
  id: string;
  uploadedFileId: string | null;
  trenNumero: number;
  kilometraje: number;
  trenOriginalCsv: number | null;
  corregidoTren: boolean;
  kilometrajeOriginalCsv: number | null;
  corregidoKilometraje: boolean;
  responsableMantenimientoNombre: string | null;
  comentariosActividad: string | null;
  verificado: boolean;
  tablaBloqueada: boolean;
  esPosibleDuplicado: boolean;
}

// Fake de PrismaService con estado en memoria (mismo patrón que el resto del
// módulo): alcanza para probar editarFicha sin levantar una base de datos.
function crearEntorno(overrides: Partial<FakeFicha> = {}) {
  const ficha: FakeFicha = {
    id: 'ficha-1',
    uploadedFileId: 'file-1',
    trenNumero: 32,
    kilometraje: 125000,
    trenOriginalCsv: 32,
    corregidoTren: false,
    kilometrajeOriginalCsv: 125000,
    corregidoKilometraje: false,
    responsableMantenimientoNombre: null,
    comentariosActividad: null,
    verificado: false,
    tablaBloqueada: false,
    esPosibleDuplicado: false,
    ...overrides,
  };
  const file = { id: 'file-1', status: 'review' };
  const tren33 = { id: 'tren-33', numero: 33, modelo: 'alstom_metropolis9000' };
  const tecnicos = [1, 2, 3, 4].map((posicion) => ({
    measurementSheetId: ficha.id,
    posicion,
    nombre: null,
    firma: null,
    fecha: null,
  }));
  const instrumentos = [1, 2, 3].map((posicion) => ({
    measurementSheetId: ficha.id,
    posicion,
    codigo: null,
  }));
  const scanEditLogs: unknown[] = [];

  const prisma = {
    measurementSheet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === ficha.id ? { ...ficha } : null),
      ),
      update: jest.fn(({ data }: { data: Partial<FakeFicha> }) => {
        Object.assign(ficha, data);
        return Promise.resolve({ ...ficha });
      }),
    },
    uploadedFile: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === file.id ? { ...file } : null),
      ),
    },
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(
          where.numero === 33
            ? tren33
            : where.numero === 32
              ? { id: 'tren-32', numero: 32, modelo: 'alstom_metropolis9000' }
              : null,
        ),
      ),
    },
    measurementSheetTecnico: {
      findMany: jest.fn(() => Promise.resolve(tecnicos)),
      update: jest.fn(() => Promise.resolve(undefined)),
    },
    measurementSheetInstrumento: {
      findMany: jest.fn(() => Promise.resolve(instrumentos)),
      update: jest.fn(() => Promise.resolve(undefined)),
    },
    scanRecord: {
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    scanEditLog: {
      create: jest.fn(({ data }: { data: unknown }) => {
        scanEditLogs.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  return {
    prisma: {
      ...prisma,
      $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) =>
        fn(prisma),
      ),
    },
    fichaRef: () => ficha,
    scanEditLogs,
  };
}

describe('NewMeasurementPreviewService.editarFicha — discrepancia Tren vs CSV', () => {
  it('editar el Tren a un valor distinto del CSV marca corregidoTren=true pero NO bloquea', async () => {
    const { prisma, fichaRef, scanEditLogs } = crearEntorno();
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    const resultado = await service.editarFicha(
      'ficha-1',
      { trenNumero: 33 },
      'user-1',
    );

    expect(resultado).toBeDefined();
    expect(fichaRef().trenNumero).toBe(33);
    expect(fichaRef().corregidoTren).toBe(true);
    expect(scanEditLogs).toHaveLength(1);
  });

  it('editar el Tren al MISMO valor del CSV mantiene corregidoTren=false', async () => {
    const { prisma, fichaRef } = crearEntorno();
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    await service.editarFicha('ficha-1', { trenNumero: 32 }, 'user-1');

    expect(fichaRef().trenNumero).toBe(32);
    expect(fichaRef().corregidoTren).toBe(false);
  });

  it('no editar el Tren (dto sin trenNumero) no toca corregidoTren', async () => {
    const { prisma, fichaRef } = crearEntorno({ corregidoTren: false });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    await service.editarFicha(
      'ficha-1',
      { comentariosActividad: 'todo bien' },
      'user-1',
    );

    expect(fichaRef().corregidoTren).toBe(false);
    expect(fichaRef().comentariosActividad).toBe('todo bien');
  });

  it('editar Tren/Kilometraje/Fecha con la tabla bloqueada rechaza con 423', async () => {
    const { prisma } = crearEntorno({ tablaBloqueada: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    try {
      await service.editarFicha('ficha-1', { trenNumero: 33 }, 'user-1');
      throw new Error('debería haber lanzado 423');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(423);
    }
  });

  it('editar el Tren resetea verificado a false (obliga a re-verificar antes de bloquear)', async () => {
    const { prisma, fichaRef } = crearEntorno({ verificado: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    expect(fichaRef().verificado).toBe(true);

    await service.editarFicha('ficha-1', { trenNumero: 33 }, 'user-1');

    expect(fichaRef().verificado).toBe(false);
  });

  it('editar un campo que NO es Tren/Kilometraje/Fecha no toca verificado', async () => {
    const { prisma, fichaRef } = crearEntorno({ verificado: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    await service.editarFicha(
      'ficha-1',
      { comentariosActividad: 'todo bien' },
      'user-1',
    );

    expect(fichaRef().verificado).toBe(true);
  });

  // Punto 4 del enunciado: editar cualquier valor del header (no solo
  // Tren/Kilometraje/Fecha) resetea un duplicado detectado en la carga
  // forzada — ver NewMeasurementValidationService.verificar.
  it('editar el header con esPosibleDuplicado=true lo resetea a false', async () => {
    const { prisma, fichaRef } = crearEntorno({ esPosibleDuplicado: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    await service.editarFicha(
      'ficha-1',
      { comentariosActividad: 'todo bien' },
      'user-1',
    );

    expect(fichaRef().esPosibleDuplicado).toBe(false);
  });

  it('editar la ficha sin esPosibleDuplicado activo no toca el campo (sin escritura de más)', async () => {
    const { prisma, fichaRef } = crearEntorno({ esPosibleDuplicado: false });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    await service.editarFicha(
      'ficha-1',
      { comentariosActividad: 'todo bien' },
      'user-1',
    );

    expect(fichaRef().esPosibleDuplicado).toBe(false);
  });
});

describe('NewMeasurementPreviewService.editarFila — bloqueo y reseteo de verificado', () => {
  function crearEntornoFila(overrides: Partial<FakeFicha> = {}) {
    const ficha: FakeFicha = {
      id: 'ficha-1',
      uploadedFileId: 'file-1',
      trenNumero: 32,
      kilometraje: 125000,
      trenOriginalCsv: 32,
      corregidoTren: false,
      kilometrajeOriginalCsv: 125000,
      corregidoKilometraje: false,
      responsableMantenimientoNombre: null,
      comentariosActividad: null,
      verificado: false,
      tablaBloqueada: false,
      esPosibleDuplicado: false,
      ...overrides,
    };
    const file = { id: 'file-1', status: 'review' };
    const fila = {
      id: 'fila-1',
      fileId: 'file-1',
      discId: null as string | null,
      responsableNombre: '',
      trenNumero: 32,
      kilometraje: 125000,
      fecha: new Date('2026-01-15'),
      motivo: 'Medición',
      cocheExcel: 'MA1',
      numeroCocheExcel: 201,
      bogieExcel: 'PB3',
      ejeExcel: 1,
      ruedaExcel: 1,
      ubicacionExcel: 'izquierdo',
      hValue: 2,
      tValue: 10,
      rdValue: 8,
      estadoCalculado: 'OK',
      estadoSugeridoExcel: null as string | null,
      corregidoPorHoja: false,
      trenOriginalExcel: null as number | null,
      discrepanciaEstadoExcel: false,
      hojaExcelOrigen: null as string | null,
      observacion: null as string | null,
      kmInvalido: false,
      fechaInvalido: false,
      tInvalido: false,
      rdInvalido: false,
    };

    const base = {
      measurementSheet: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === ficha.id ? { ...ficha } : null),
        ),
        update: jest.fn(({ data }: { data: Partial<FakeFicha> }) => {
          Object.assign(ficha, data);
          return Promise.resolve({ ...ficha });
        }),
      },
      uploadedFile: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === file.id ? { ...file } : null),
        ),
      },
      scanRecord: {
        findFirst: jest.fn(({ where }: { where: { id?: string } }) =>
          Promise.resolve(where.id === fila.id ? { ...fila } : null),
        ),
        update: jest.fn(({ data }: { data: Partial<typeof fila> }) => {
          Object.assign(fila, data);
          return Promise.resolve({ ...fila });
        }),
      },
      scanEditLog: {
        create: jest.fn(() => Promise.resolve(undefined)),
      },
    };

    return {
      prisma: {
        ...base,
        $transaction: jest.fn((fn: (tx: typeof base) => Promise<unknown>) =>
          fn(base),
        ),
      },
      fichaRef: () => ficha,
    };
  }

  it('editar una fila DESPUÉS de un /validate exitoso resetea verificado a false', async () => {
    const { prisma, fichaRef } = crearEntornoFila({ verificado: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    expect(fichaRef().verificado).toBe(true);

    await service.editarFila(
      'ficha-1',
      'fila-1',
      { observacion: 'revisado' },
      'user-1',
    );

    expect(fichaRef().verificado).toBe(false);
  });

  // Punto 4 del enunciado: "editar un solo valor de una fila... resetea
  // es_posible_duplicado y /validate vuelve a evaluar T/Rd/Km/Fecha
  // normalmente" — acá se prueba el reseteo; NewMeasurementValidationService.
  // verificar (spec aparte) prueba que, ya en false, corre la validación
  // cruzada normal.
  it('editar un solo valor de una fila con esPosibleDuplicado=true lo resetea a false', async () => {
    const { prisma, fichaRef } = crearEntornoFila({ esPosibleDuplicado: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    expect(fichaRef().esPosibleDuplicado).toBe(true);

    await service.editarFila(
      'ficha-1',
      'fila-1',
      { observacion: 'revisado' },
      'user-1',
    );

    expect(fichaRef().esPosibleDuplicado).toBe(false);
  });

  it('editar una fila con la tabla bloqueada rechaza con 423', async () => {
    const { prisma } = crearEntornoFila({ tablaBloqueada: true });
    const brakeDiscRules = {};
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    try {
      await service.editarFila(
        'ficha-1',
        'fila-1',
        { observacion: 'revisado' },
        'user-1',
      );
      throw new Error('debería haber lanzado 423');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(423);
    }
  });

  // Punto 1 del enunciado: "Observación" NO es un campo de texto libre — es
  // el estado calculado del disco (clasificarEstadoConReperfilado, el mismo
  // motor que Migración/Mediciones), expuesto en estadoCalculado. El campo
  // `observacion` (texto libre) sigue existiendo aparte, sin relación con esto.
  it('editar H/T calcula estadoCalculado con clasificarEstadoConReperfilado (REPERFILADO), nunca un texto libre', async () => {
    const { prisma } = crearEntornoFila();
    const brakeDiscRules = {
      obtenerEvaluador: jest
        .fn()
        .mockResolvedValue(new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO)),
    };
    const validationService = {};
    const service = new NewMeasurementPreviewService(
      prisma as never,
      brakeDiscRules as never,
      validationService as never,
    );

    // H=1.8 (>=1.6) y T=3.3 -> Rd=T-H=1.5; (Rd-0.8)=0.7 > 0.4 -> REPERFILADO
    // (ver BrakeDiscRulesEngine.clasificarEstadoConReperfilado).
    const fila = await service.editarFila(
      'ficha-1',
      'fila-1',
      { hValue: 1.8, tValue: 3.3, observacion: 'texto libre sin relación' },
      'user-1',
    );

    expect(fila.estadoCalculado).toBe('REPERFILADO');
    // Decoupled del texto libre: observacion no influye en el cálculo.
    expect(fila.observacion).toBe('texto libre sin relación');
  });
});
