import { FleetService } from './fleet.service';

const evaluador = {
  clasificarEstadoConReperfilado: jest.fn((rd: number, h: number) => {
    if (h === 9) return 'REPERFILADO';
    if (rd <= 0) return 'CRITICO';
    if (rd <= 0.4) return 'CAMBIO';
    return 'OK';
  }),
};

function crearService(prisma: Record<string, any>) {
  return new FleetService(
    prisma as any,
    { obtenerEvaluador: jest.fn().mockResolvedValue(evaluador) } as any,
    {
      resolver: jest.fn((tren, coche, bogie) =>
        tren === 6 && coche === 'MA1' && bogie === 'PB3' ? 'M146-D' : null,
      ),
      buscarPorCodigo: jest.fn(() => ({
        trenNumero: 6,
        coche: 'MA1',
        posicion: 'PB3',
      })),
    } as any,
  );
}

describe('FleetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('summary devuelve 39 trenes ordenados 6 a 44 y cuenta alertas actuales', async () => {
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue([
          {
            wagonUnit: { tren: { numero: 7 } },
            scanRecords: [
              { fecha: new Date('2026-01-03'), rdValue: 2, hValue: 9 },
            ],
          },
          {
            wagonUnit: { tren: { numero: 6 } },
            scanRecords: [
              { fecha: new Date('2026-01-01'), rdValue: 0.3, hValue: 0 },
            ],
          },
          {
            wagonUnit: { tren: { numero: 6 } },
            scanRecords: [
              { fecha: new Date('2026-01-02'), rdValue: -0.1, hValue: 0 },
            ],
          },
        ]),
      },
    };
    const service = crearService(prisma);

    const summary = await service.summary();

    expect(summary).toHaveLength(39);
    expect(summary[0].tren).toBe(6);
    expect(summary.at(-1)?.tren).toBe(44);
    expect(summary[0]).toMatchObject({
      fechaUltimaMedicion: '2026-01-02',
      conteoAlerta: { cambio: 1, critico: 1, reperfilado: 0 },
    });
    expect(summary[1]).toMatchObject({
      tren: 7,
      conteoAlerta: { cambio: 0, critico: 0, reperfilado: 1 },
    });
  });

  it('detalle arma 6 coches x 2 bogies x 2 ejes x 2 discos y resuelve M146-D para ambos lados', async () => {
    const prisma = {
      train: {
        findUnique: jest.fn().mockResolvedValue({
          numero: 6,
          wagonUnits: [
            {
              id: 'wu-1',
              tipoCoche: 'MA1',
              numeroCoche: 101,
              brakeDiscs: [
                {
                  id: 'd-i',
                  bogieCodigo: 'PB3',
                  ejeNumero: 1,
                  lado: 'izquierdo',
                  ruedaNumero: 1,
                },
                {
                  id: 'd-d',
                  bogieCodigo: 'PB3',
                  ejeNumero: 1,
                  lado: 'derecho',
                  ruedaNumero: 2,
                },
              ],
            },
          ],
        }),
      },
      scanRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            discId: 'd-i',
            fecha: new Date('2026-06-02'),
            hValue: 1.1,
            tValue: 2.2,
            rdValue: 1.1,
            estadoCalculado: 'OK',
          },
        ]),
      },
    };
    const service = crearService(prisma);

    const detalle = await service.detalle(6);

    expect(detalle.coches).toHaveLength(6);
    const bogies = detalle.coches.flatMap((coche: any) => coche.bogies);
    const ejes = bogies.flatMap((bogie: any) => bogie.ejes);
    const discos = ejes.flatMap((eje: any) => eje.discos);
    expect(bogies).toHaveLength(12);
    expect(ejes).toHaveLength(24);
    expect(discos).toHaveLength(48);
    expect(discos.slice(0, 2).map((disco: any) => disco.codigoDisco)).toEqual([
      'M146-D',
      'M146-D',
    ]);
    expect(discos[0]).toMatchObject({ rd: 1.1, estadoCalculado: 'OK' });
    expect(discos[1]).toMatchObject({
      rd: null,
      h: null,
      t: null,
      estadoCalculado: null,
      fechaUltimaMedicion: null,
    });
  });

  it('histórico de un disco específico no mezcla el otro lado', async () => {
    const prisma = {
      brakeDisc: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'disc-left', ejeNumero: 1 }]),
      },
      scanRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            fecha: new Date('2026-01-01'),
            hValue: 0.5,
            tValue: 2,
            rdValue: 1.5,
            estadoCalculado: 'OK',
          },
          {
            fecha: new Date('2026-02-01'),
            hValue: 0.8,
            tValue: 2.1,
            rdValue: 1.3,
            estadoCalculado: 'OK',
          },
        ]),
      },
    };
    const service = crearService(prisma);

    const historico = await service.historicoDisco('M146-D', 'izquierdo');

    expect(prisma.brakeDisc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lado: 'izquierdo' }),
      }),
    );
    expect(prisma.scanRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { discId: 'disc-left', file: { status: 'committed' } },
      }),
    );
    expect(historico.actual).toMatchObject({ fecha: '2026-02-01', rd: 1.3 });
    expect(historico.historico).toHaveLength(2);
  });
});
