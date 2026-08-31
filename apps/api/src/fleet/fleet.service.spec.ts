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

  it('summary devuelve 44 trenes ordenados 1 a 44 (Ansaldo + Alstom) y cuenta alertas actuales', async () => {
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

    expect(summary).toHaveLength(44);
    expect(summary[0].tren).toBe(1);
    expect(summary.at(-1)?.tren).toBe(44);
    const tren6 = summary.find((s) => s.tren === 6);
    expect(tren6).toMatchObject({
      fechaUltimaMedicion: '2026-01-02',
      conteoEstado: {
        ok: 0,
        seguimiento: 0,
        cambio: 1,
        critico: 1,
        reperfilado: 0,
      },
    });
    const tren7 = summary.find((s) => s.tren === 7);
    expect(tren7).toMatchObject({
      tren: 7,
      conteoEstado: {
        ok: 0,
        seguimiento: 0,
        cambio: 0,
        critico: 0,
        reperfilado: 1,
      },
    });
  });

  it('detalle arma 6 coches x 2 bogies x 2 ejes x 2 discos y resuelve M146-D para ambos lados', async () => {
    const prisma = {
      train: {
        findUnique: jest.fn().mockResolvedValue({
          numero: 6,
          modelo: 'alstom_metropolis9000',
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
                  posicion: 'unica',
                  ruedaNumero: 1,
                },
                {
                  id: 'd-d',
                  bogieCodigo: 'PB3',
                  ejeNumero: 1,
                  lado: 'derecho',
                  posicion: 'unica',
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

  it('resumenTrenesCriticos calcula score compuesto, disco de menor Rd y promedio fleet-wide', async () => {
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue([
          // Tren 6: 1 CRITICO (rd=-0.1) + 1 CAMBIO (rd=0.3) -> score 3*1+1=4
          {
            bogieCodigo: 'PB3',
            ejeNumero: 1,
            wagonUnit: { tipoCoche: 'MA1', tren: { numero: 6 } },
            scanRecords: [{ rdValue: -0.1, hValue: 0 }],
          },
          {
            bogieCodigo: 'PB3',
            ejeNumero: 2,
            wagonUnit: { tipoCoche: 'MA1', tren: { numero: 6 } },
            scanRecords: [{ rdValue: 0.3, hValue: 0 }],
          },
          // Tren 7: 2 CAMBIO -> score 1*2=2 (menor que tren 6)
          {
            bogieCodigo: 'PB1',
            ejeNumero: 1,
            wagonUnit: { tipoCoche: 'MB1', tren: { numero: 7 } },
            scanRecords: [{ rdValue: 0.35, hValue: 0 }],
          },
          {
            bogieCodigo: 'PB1',
            ejeNumero: 2,
            wagonUnit: { tipoCoche: 'MB1', tren: { numero: 7 } },
            scanRecords: [{ rdValue: 0.38, hValue: 0 }],
          },
          // Tren 8: OK, no cuenta como crítico ni afecta el score
          {
            bogieCodigo: 'PB2',
            ejeNumero: 1,
            wagonUnit: { tipoCoche: 'MB2', tren: { numero: 8 } },
            scanRecords: [{ rdValue: 1.2, hValue: 0 }],
          },
        ]),
      },
    };
    const service = crearService(prisma);

    const resumen = await service.resumenTrenesCriticos();

    expect(resumen.trenesConDiscosCriticos).toBe(2); // trenes 6 y 7
    expect(resumen.discosCriticosTotales).toBe(4); // 1+1 (tren6) + 2 (tren7)
    expect(resumen.trenMasCritico).toMatchObject({
      trenNumero: 6,
      discosCriticos: 1,
      discosCambio: 1,
      rdMinimo: -0.1,
    });
    expect(resumen.discoMenorRd).toMatchObject({ trenNumero: 6, rd: -0.1 });
    expect(resumen.rdPromedio).toBeCloseTo((-0.1 + 0.3 + 0.35 + 0.38 + 1.2) / 5, 6);
  });

  it('resumenTrenesCriticos filtra por fabricante vía Train.modelo', async () => {
    const prisma = { brakeDisc: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = crearService(prisma);

    await service.resumenTrenesCriticos('ansaldo_mb300' as any);

    expect(prisma.brakeDisc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wagonUnit: expect.objectContaining({
            tren: expect.objectContaining({ modelo: 'ansaldo_mb300' }),
          }),
        }),
      }),
    );
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
