import { UnprocessableEntityException } from '@nestjs/common';
import { NewMeasurementValidationService } from './new-measurement-validation.service';

interface FakeFicha {
  id: string;
  uploadedFileId: string | null;
  trenNumero: number;
  kilometraje: number;
  fechaFicha: Date;
  verificado: boolean;
}

interface FakeScanRecord {
  id: string;
  fileId: string;
  discId: string | null;
  trenNumero: number;
  kilometraje: number;
  fecha: Date;
  cocheExcel: string | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  tValue: number;
  rdValue: number;
  kmInvalido: boolean;
  fechaInvalido: boolean;
  tInvalido: boolean;
  rdInvalido: boolean;
  excluidaDelCommit: boolean;
}

// Fake de PrismaService con estado en memoria real (mismo patrón que
// new-measurement-commit.service.spec.ts): el tren 32 tiene un único coche
// MA1 sembrado (wagon-ma1); brakeDisc.findUnique sintetiza un disco por cada
// combinación eje/lado bajo ese coche — alcanza para ejercitar la resolución
// de identidad de resolverDiscIdSilencioso sin levantar una base de datos.
function crearEntorno(opts: {
  ficha?: Partial<FakeFicha>;
  scanRecords?: FakeScanRecord[];
}) {
  const ficha: FakeFicha = {
    id: 'ficha-1',
    uploadedFileId: 'file-1',
    trenNumero: 32,
    kilometraje: 120000,
    fechaFicha: new Date('2026-03-01'),
    verificado: false,
    ...opts.ficha,
  };
  let scanRecords: FakeScanRecord[] = opts.scanRecords ?? [];
  const tren = { id: 'tren-32', numero: 32 };
  const wagon = { id: 'wagon-ma1', trenId: 'tren-32', tipoCoche: 'MA1' };

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
    scanRecord: {
      findMany: jest.fn(({ where }: { where: { fileId: string } }) =>
        Promise.resolve(scanRecords.filter((r) => r.fileId === where.fileId)),
      ),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            trenNumero?: number;
            discId?: string | { not: null };
          };
        }) => {
          let candidatos = scanRecords.filter((r) => r.discId !== null);
          if (where.trenNumero !== undefined) {
            candidatos = candidatos.filter(
              (r) => r.trenNumero === where.trenNumero,
            );
          }
          if (typeof where.discId === 'string') {
            candidatos = candidatos.filter((r) => r.discId === where.discId);
          }
          candidatos = [...candidatos].sort((a, b) => {
            if (a.fecha.getTime() !== b.fecha.getTime()) {
              return b.fecha.getTime() - a.fecha.getTime();
            }
            if (a.kilometraje !== b.kilometraje) {
              return b.kilometraje - a.kilometraje;
            }
            return b.id.localeCompare(a.id);
          });
          return Promise.resolve(candidatos[0] ?? null);
        },
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
    // Sintetiza un disco físico determinístico por cada combinación eje/lado
    // bajo el único coche sembrado (wagon-ma1) — evita hardcodear un solo
    // disco cuando un test necesita más de uno (ej. dos filas de la misma
    // ficha, cada una comparándose contra el historial de SU PROPIO disco).
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
          if (c.wagonUnitId !== wagon.id) return Promise.resolve(null);
          return Promise.resolve({
            id: `disco-eje${c.ejeNumero}-${c.lado}`,
            wagonUnitId: c.wagonUnitId,
            bogieCodigo: c.bogieCodigo,
            ejeNumero: c.ejeNumero,
            lado: c.lado,
          });
        },
      ),
    },
  };

  return {
    // $transaction acá recibe un ARRAY de promesas ya disparadas (ver
    // recalcularFlags/verificar), no un callback — a diferencia del patrón
    // usado en new-measurement-commit.service.spec.ts.
    prisma: {
      ...prisma,
      $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    },
    fichaRef: () => ficha,
    scanRecordsRef: () => scanRecords,
  };
}

function filaBase(overrides: Partial<FakeScanRecord>): FakeScanRecord {
  return {
    id: 'fila-1',
    fileId: 'file-1',
    discId: null,
    trenNumero: 32,
    kilometraje: 120000,
    fecha: new Date('2026-03-01'),
    cocheExcel: 'MA1',
    bogieExcel: 'PB3',
    ejeExcel: 1,
    ubicacionExcel: 'izquierdo',
    tValue: 5,
    rdValue: 3,
    kmInvalido: false,
    fechaInvalido: false,
    tInvalido: false,
    rdInvalido: false,
    excluidaDelCommit: false,
    ...overrides,
  };
}

describe('NewMeasurementValidationService.recalcularFlags', () => {
  it('fila con T mayor al último confirmado del MISMO disco se marca t_invalido', async () => {
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior', // ya confirmada, en OTRA carga
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const filaEnCurso = filaBase({ id: 'fila-1', tValue: 10, rdValue: 3 });
    const { prisma, scanRecordsRef } = crearEntorno({
      scanRecords: [referenciaDisco, filaEnCurso],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resultado = await service.recalcularFlags('ficha-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].tInvalido).toBe(true);
    expect(scanRecordsRef().find((r) => r.id === 'fila-1')?.tInvalido).toBe(
      true,
    );
  });

  it('T menor o igual al último confirmado del disco NO se marca t_invalido', async () => {
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const filaEnCurso = filaBase({ id: 'fila-1', tValue: 8, rdValue: 3 });
    const { prisma } = crearEntorno({
      scanRecords: [referenciaDisco, filaEnCurso],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const [resultado] = await service.recalcularFlags('ficha-1');

    expect(resultado.tInvalido).toBe(false);
  });

  it('ficha con kilometraje menor al último confirmado del TREN se marca km_invalido en TODAS las filas', async () => {
    const referenciaTren = filaBase({
      id: 'referencia-tren',
      fileId: 'file-anterior',
      discId: 'disco-otro', // otro disco del mismo tren — el nivel es TREN, no disco
      fecha: new Date('2026-01-01'),
      kilometraje: 150000,
    });
    const fila1 = filaBase({ id: 'fila-1', ejeExcel: 1 });
    const fila2 = filaBase({
      id: 'fila-2',
      ejeExcel: 2,
      bogieExcel: 'PB3',
    });
    const { prisma, scanRecordsRef } = crearEntorno({
      ficha: { kilometraje: 120000 }, // < 150000
      scanRecords: [referenciaTren, fila1, fila2],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await service.recalcularFlags('ficha-1');

    const filas = scanRecordsRef().filter((r) => r.id !== 'referencia-tren');
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      expect(f.kmInvalido).toBe(true);
    }
  });

  it('sin medición previa confirmada del disco/tren, ninguna fila se marca inválida', async () => {
    const fila1 = filaBase({ id: 'fila-1' });
    const { prisma, scanRecordsRef } = crearEntorno({
      scanRecords: [fila1],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await service.recalcularFlags('ficha-1');

    const f = scanRecordsRef()[0];
    expect(f.kmInvalido).toBe(false);
    expect(f.fechaInvalido).toBe(false);
    expect(f.tInvalido).toBe(false);
    expect(f.rdInvalido).toBe(false);
  });
});

describe('NewMeasurementValidationService.verificar', () => {
  it('excluye del commit SOLO las filas que siguen inválidas tras la re-evaluación', async () => {
    const referenciaDiscoEje1 = filaBase({
      id: 'referencia-disco-eje1',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const referenciaDiscoEje2 = filaBase({
      id: 'referencia-disco-eje2',
      fileId: 'file-anterior',
      discId: 'disco-eje2-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    // fila-1 quedó marcada t_invalido por una validación vieja (stale), pero
    // el usuario YA corrigió el valor de T — verificar() recalcula desde cero
    // y debe encontrarla válida ahora.
    const filaCorregida = filaBase({
      id: 'fila-1',
      tValue: 8,
      rdValue: 3,
      tInvalido: true,
    });
    // fila-2 sigue con T mayor al último confirmado de SU disco — sigue inválida.
    const filaInvalida = filaBase({
      id: 'fila-2',
      ejeExcel: 2,
      tValue: 12,
      rdValue: 3,
    });
    const { prisma, fichaRef, scanRecordsRef } = crearEntorno({
      scanRecords: [
        referenciaDiscoEje1,
        referenciaDiscoEje2,
        filaCorregida,
        filaInvalida,
      ],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.todoValido).toBe(false);
    expect(resumen.filasIncluidas).toBe(1);
    expect(resumen.filasExcluidas).toHaveLength(1);
    expect(resumen.filasExcluidas[0].id).toBe('fila-2');

    const filas = scanRecordsRef().filter((r) => r.id.startsWith('fila-'));
    expect(filas.find((f) => f.id === 'fila-1')?.excluidaDelCommit).toBe(false);
    expect(filas.find((f) => f.id === 'fila-2')?.excluidaDelCommit).toBe(true);
    expect(fichaRef().verificado).toBe(true);
  });

  it('todoValido=true y verificado=true cuando ninguna fila queda inválida', async () => {
    const filaValida = filaBase({ id: 'fila-1' });
    const { prisma, fichaRef } = crearEntorno({
      scanRecords: [filaValida],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.todoValido).toBe(true);
    expect(resumen.filasExcluidas).toHaveLength(0);
    expect(resumen.filasIncluidas).toBe(1);
    expect(fichaRef().verificado).toBe(true);
  });
});

describe('NewMeasurementValidationService.bloquear', () => {
  it('rechaza con 422 si la ficha no fue verificada (verificado=false)', async () => {
    const { prisma } = crearEntorno({ ficha: { verificado: false } });
    const service = new NewMeasurementValidationService(prisma as never);

    await expect(service.bloquear('ficha-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('bloquea la tabla cuando la ficha está verificada', async () => {
    const { prisma } = crearEntorno({ ficha: { verificado: true } });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.bloquear('ficha-1');

    expect(resumen).toEqual({ fichaId: 'ficha-1', tablaBloqueada: true });
  });
});
