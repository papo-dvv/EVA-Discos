import type { PrismaService } from '../prisma/prisma.service';
import { WearRateCalculatorService } from './wear-rate-calculator.service';
import { WearRateService } from './wear-rate.service';

interface FakeScanRecord {
  id: string;
  discId: string;
  trenNumero: number;
  fecha: Date;
  kilometraje: number;
  rdValue: number;
  motivo: string;
}

interface FakeWearRatePair {
  id: string;
  discId: string;
  scanRecordId1: string;
  scanRecordId2: string;
  trenNumero: number;
  fecha1: Date;
  fecha2: Date;
  tasa: number;
  tasaMensual: number;
  kmMensualUsado: number;
  esValido: boolean;
  comentario: string;
}

interface FakeBrakeDisc {
  id: string;
  bogieCodigo: string;
  ejeNumero: number;
  lado: string;
  wagonUnit: {
    tipoCoche: string;
    numeroCoche: number;
    tren: { modelo: string };
  };
}

// Identidad por defecto de CUALQUIER disco pedido, salvo que el test pase su
// propio `discos` (ver crearPrismaFake): a la mayoría de los tests no les
// importa el valor en sí, solo que se resuelva y se propague a cada par.
function discoPorDefecto(id: string): FakeBrakeDisc {
  return {
    id,
    bogieCodigo: 'PB2',
    ejeNumero: 1,
    lado: 'izquierdo',
    wagonUnit: {
      tipoCoche: 'MA1',
      numeroCoche: 129,
      tren: { modelo: 'alstom_metropolis9000' },
    },
  };
}

// Fake de PrismaService con estado en memoria real: scanRecord.findMany
// devuelve el historial ordenado (fecha asc, id asc) del disco pedido,
// wearRatePair.findFirst simula el orderBy { fecha2: 'desc' } que usa el
// servicio para hallar la "frontera", y createMany respeta skipDuplicates
// sobre (scanRecordId1, scanRecordId2) — igual que la constraint única real.
function crearPrismaFake(opciones: {
  scanRecords: FakeScanRecord[];
  wearRatePairs?: FakeWearRatePair[];
  kmMensual?: string | null;
  discos?: Record<string, FakeBrakeDisc>;
}) {
  const scanRecords = opciones.scanRecords;
  const wearRatePairs: FakeWearRatePair[] = opciones.wearRatePairs
    ? [...opciones.wearRatePairs]
    : [];
  const kmMensual =
    opciones.kmMensual === undefined ? '11300' : opciones.kmMensual;
  const discos = opciones.discos ?? {};
  let idSeq = 0;

  const brakeDiscFindUniqueOrThrow = jest.fn(
    ({ where }: { where: { id: string } }): Promise<FakeBrakeDisc> =>
      Promise.resolve(discos[where.id] ?? discoPorDefecto(where.id)),
  );

  const createMany = jest.fn(
    ({ data }: { data: Omit<FakeWearRatePair, 'id'>[] }) => {
      let insertados = 0;
      for (const d of data) {
        const yaExiste = wearRatePairs.some(
          (p) =>
            p.scanRecordId1 === d.scanRecordId1 &&
            p.scanRecordId2 === d.scanRecordId2,
        );
        if (!yaExiste) {
          wearRatePairs.push({ id: `wrp-${++idSeq}`, ...d });
          insertados++;
        }
      }
      return Promise.resolve({ count: insertados });
    },
  );

  const findFirst = jest.fn(
    ({
      where,
    }: {
      where: { discId: string };
    }): Promise<FakeWearRatePair | null> => {
      const candidatos = wearRatePairs.filter((p) => p.discId === where.discId);
      if (candidatos.length === 0) return Promise.resolve(null);
      const ordenados = [...candidatos].sort(
        (a, b) => b.fecha2.getTime() - a.fecha2.getTime(),
      );
      return Promise.resolve(ordenados[0]);
    },
  );

  const scanRecordFindMany = jest.fn(
    ({ where }: { where: { discId: string } }): Promise<FakeScanRecord[]> => {
      const filtrados = scanRecords.filter((r) => r.discId === where.discId);
      const ordenados = [...filtrados].sort((a, b) => {
        const df = a.fecha.getTime() - b.fecha.getTime();
        return df !== 0 ? df : a.id.localeCompare(b.id);
      });
      return Promise.resolve(ordenados);
    },
  );

  const systemParamFindUnique = jest.fn(
    ({ where }: { where: { clave: string } }) => {
      if (where.clave === 'km_mensual' && kmMensual !== null) {
        return Promise.resolve({ clave: 'km_mensual', valor: kmMensual });
      }
      return Promise.resolve(null);
    },
  );

  return {
    prisma: {
      wearRatePair: { findFirst, createMany },
      scanRecord: { findMany: scanRecordFindMany },
      systemParam: { findUnique: systemParamFindUnique },
      brakeDisc: { findUniqueOrThrow: brakeDiscFindUniqueOrThrow },
    } as unknown as PrismaService,
    wearRatePairs,
    createMany,
    findFirst,
    scanRecordFindMany,
    brakeDiscFindUniqueOrThrow,
  };
}

function registro(overrides: Partial<FakeScanRecord>): FakeScanRecord {
  return {
    id: 'r-1',
    discId: 'disco-1',
    trenNumero: 6,
    fecha: new Date('2024-01-01'),
    kilometraje: 100_000,
    rdValue: 10,
    motivo: 'Medición',
    ...overrides,
  };
}

function servicio(prisma: PrismaService) {
  return new WearRateService(prisma, new WearRateCalculatorService());
}

describe('WearRateService.recalcularParaDiscos', () => {
  it('disco sin pares previos: genera un par por cada medición consecutiva', async () => {
    const { prisma, wearRatePairs } = crearPrismaFake({
      scanRecords: [
        registro({
          id: 'r-1',
          fecha: new Date('2024-01-01'),
          kilometraje: 100_000,
          rdValue: 10,
        }),
        registro({
          id: 'r-2',
          fecha: new Date('2024-02-01'),
          kilometraje: 105_000,
          rdValue: 9.5,
        }),
        registro({
          id: 'r-3',
          fecha: new Date('2024-03-01'),
          kilometraje: 110_000,
          rdValue: 9.0,
        }),
      ],
    });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    expect(wearRatePairs).toHaveLength(2);
    expect(
      wearRatePairs.map((p) => [p.scanRecordId1, p.scanRecordId2]),
    ).toEqual([
      ['r-1', 'r-2'],
      ['r-2', 'r-3'],
    ]);
  });

  it('con un par ya existente (frontera), solo genera el par nuevo: no reprocesa el existente', async () => {
    const parExistente: FakeWearRatePair = {
      id: 'wrp-existente',
      discId: 'disco-1',
      scanRecordId1: 'r-1',
      scanRecordId2: 'r-2',
      trenNumero: 6,
      fecha1: new Date('2024-01-01'),
      fecha2: new Date('2024-02-01'),
      tasa: 0.0001,
      tasaMensual: 1.13,
      kmMensualUsado: 11_300,
      esValido: true,
      comentario: 'Válido',
    };
    const { prisma, wearRatePairs, createMany } = crearPrismaFake({
      scanRecords: [
        registro({
          id: 'r-1',
          fecha: new Date('2024-01-01'),
          kilometraje: 100_000,
          rdValue: 10,
        }),
        registro({
          id: 'r-2',
          fecha: new Date('2024-02-01'),
          kilometraje: 105_000,
          rdValue: 9.5,
        }),
        registro({
          id: 'r-3',
          fecha: new Date('2024-03-01'),
          kilometraje: 110_000,
          rdValue: 9.0,
        }),
      ],
      wearRatePairs: [parExistente],
    });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    // El par existente sigue exactamente igual (mismo objeto, no se tocó).
    expect(wearRatePairs).toHaveLength(2);
    expect(wearRatePairs[0]).toBe(parExistente);
    // Solo se insertó el par nuevo (r-2, r-3).
    expect(createMany).toHaveBeenCalledTimes(1);
    const data = createMany.mock.calls[0][0].data as Array<{
      scanRecordId1: string;
      scanRecordId2: string;
    }>;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      scanRecordId1: 'r-2',
      scanRecordId2: 'r-3',
    });
  });

  it('recalcular un disco DISTINTO no reprocesa ni toca los pares de otros discos', async () => {
    const parDisco1: FakeWearRatePair = {
      id: 'wrp-1',
      discId: 'disco-1',
      scanRecordId1: 'a-1',
      scanRecordId2: 'a-2',
      trenNumero: 6,
      fecha1: new Date('2024-01-01'),
      fecha2: new Date('2024-02-01'),
      tasa: 0.0001,
      tasaMensual: 1.13,
      kmMensualUsado: 11_300,
      esValido: true,
      comentario: 'Válido',
    };
    const { prisma, wearRatePairs } = crearPrismaFake({
      scanRecords: [
        registro({
          id: 'a-1',
          discId: 'disco-1',
          fecha: new Date('2024-01-01'),
          kilometraje: 100_000,
          rdValue: 10,
        }),
        registro({
          id: 'a-2',
          discId: 'disco-1',
          fecha: new Date('2024-02-01'),
          kilometraje: 105_000,
          rdValue: 9.5,
        }),
        registro({
          id: 'b-1',
          discId: 'disco-2',
          fecha: new Date('2024-01-10'),
          kilometraje: 50_000,
          rdValue: 8,
        }),
        registro({
          id: 'b-2',
          discId: 'disco-2',
          fecha: new Date('2024-02-10'),
          kilometraje: 55_000,
          rdValue: 7.6,
        }),
      ],
      wearRatePairs: [parDisco1],
    });

    // Solo se recalcula disco-2 (ej. una medición nueva de un disco distinto).
    await servicio(prisma).recalcularParaDiscos(['disco-2']);

    expect(wearRatePairs).toHaveLength(2);
    expect(wearRatePairs.find((p) => p.discId === 'disco-1')).toBe(parDisco1);
    const nuevo = wearRatePairs.find((p) => p.discId === 'disco-2');
    expect(nuevo).toMatchObject({ scanRecordId1: 'b-1', scanRecordId2: 'b-2' });
  });

  it('no genera nada para un disco con una sola medición (no hay par que formar)', async () => {
    const { prisma, wearRatePairs, createMany, brakeDiscFindUniqueOrThrow } =
      crearPrismaFake({
        scanRecords: [registro({ id: 'r-1' })],
      });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    expect(wearRatePairs).toHaveLength(0);
    expect(createMany).not.toHaveBeenCalled();
    // Sin pares que generar, ni siquiera hace falta resolver la identidad
    // del disco (ver early-return en recalcularDisco).
    expect(brakeDiscFindUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('denormaliza tipoCoche/numeroCoche/bogieCodigo/ejeNumero/lado en cada par, resolviendo el disco UNA sola vez', async () => {
    const { prisma, createMany, brakeDiscFindUniqueOrThrow } = crearPrismaFake({
      scanRecords: [
        registro({ id: 'r-1', fecha: new Date('2024-01-01') }),
        registro({ id: 'r-2', fecha: new Date('2024-02-01') }),
        registro({ id: 'r-3', fecha: new Date('2024-03-01') }),
      ],
      discos: {
        'disco-1': {
          id: 'disco-1',
          bogieCodigo: 'PB6',
          ejeNumero: 3,
          lado: 'derecho',
          wagonUnit: {
            tipoCoche: 'MB1',
            numeroCoche: 408,
            tren: { modelo: 'alstom_metropolis9000' },
          },
        },
      },
    });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    // Un solo par generado en esta llamada, dos pares en total en el archivo
    // (r-1,r-2) y (r-2,r-3) -> igual resuelve el disco una sola vez, no dos.
    expect(brakeDiscFindUniqueOrThrow).toHaveBeenCalledTimes(1);
    const data = createMany.mock.calls[0][0].data as Array<{
      tipoCoche: string;
      numeroCoche: number;
      bogieCodigo: string;
      ejeNumero: number;
      lado: string;
    }>;
    expect(data).toHaveLength(2);
    for (const fila of data) {
      expect(fila).toMatchObject({
        tipoCoche: 'MB1',
        numeroCoche: 408,
        bogieCodigo: 'PB6',
        ejeNumero: 3,
        lado: 'derecho',
      });
    }
  });

  it('usa el km_mensual vigente de system_params como snapshot en kmMensualUsado', async () => {
    const { prisma, createMany } = crearPrismaFake({
      scanRecords: [
        registro({
          id: 'r-1',
          fecha: new Date('2024-01-01'),
          kilometraje: 0,
          rdValue: 10,
        }),
        registro({
          id: 'r-2',
          fecha: new Date('2024-02-01'),
          kilometraje: 1_000,
          rdValue: 9,
        }),
      ],
      kmMensual: '9500',
    });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    const data = createMany.mock.calls[0][0].data as Array<{
      kmMensualUsado: number;
    }>;
    expect(data[0].kmMensualUsado).toBe(9500);
  });

  it('cae al valor por defecto (11300) si system_params no tiene la clave', async () => {
    const { prisma, createMany } = crearPrismaFake({
      scanRecords: [
        registro({
          id: 'r-1',
          fecha: new Date('2024-01-01'),
          kilometraje: 0,
          rdValue: 10,
        }),
        registro({
          id: 'r-2',
          fecha: new Date('2024-02-01'),
          kilometraje: 1_000,
          rdValue: 9,
        }),
      ],
      kmMensual: null,
    });

    await servicio(prisma).recalcularParaDiscos(['disco-1']);

    const data = createMany.mock.calls[0][0].data as Array<{
      kmMensualUsado: number;
    }>;
    expect(data[0].kmMensualUsado).toBe(11_300);
  });

  it('deduplica discIds repetidos: no consulta dos veces el mismo disco', async () => {
    const { prisma, scanRecordFindMany } = crearPrismaFake({
      scanRecords: [
        registro({ id: 'r-1', fecha: new Date('2024-01-01') }),
        registro({ id: 'r-2', fecha: new Date('2024-02-01') }),
      ],
    });

    await servicio(prisma).recalcularParaDiscos([
      'disco-1',
      'disco-1',
      'disco-1',
    ]);

    expect(scanRecordFindMany).toHaveBeenCalledTimes(1);
  });

  it('no hace nada si la lista de discIds está vacía', async () => {
    const { prisma, scanRecordFindMany } = crearPrismaFake({ scanRecords: [] });

    await servicio(prisma).recalcularParaDiscos([]);

    expect(scanRecordFindMany).not.toHaveBeenCalled();
  });
});
