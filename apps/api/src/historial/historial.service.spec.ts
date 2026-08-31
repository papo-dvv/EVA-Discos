import type { PrismaService } from '../prisma/prisma.service';
import { HistorialService } from './historial.service';

function crearNewMeasurementHistoryFake(
  eventos: {
    tipo: string;
    trenNumero: number;
    createdAt: string;
    motivo: 'Medición' | 'Reperfilado';
  }[],
) {
  return {
    listar: jest.fn((_limit: number, motivo?: 'Medición' | 'Reperfilado') =>
      Promise.resolve(
        eventos
          .filter((e) => !motivo || e.motivo === motivo)
          .map((e) => ({
            id: 'x',
            tipo: e.tipo,
            trenNumero: e.trenNumero,
            fichaId: null,
            nombreArchivo: null,
            usuarioNombre: 'x',
            detalle: null,
            createdAt: e.createdAt,
          })),
      ),
    ),
  };
}

describe('HistorialService', () => {
  it('un eje cambiado (2 filas de InventoryMovement: izquierdo+derecho) cuenta como 1 evento', async () => {
    const fecha = new Date('2026-03-10T00:00:00.000Z');
    const prisma = {
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            fecha,
            brakeDisc: {
              wagonUnitId: 'wagon-1',
              bogieCodigo: 'PB2',
              ejeNumero: 1,
              wagonUnit: {
                tipoCoche: 'MA1',
                numeroCoche: 101,
                tren: { numero: 6 },
              },
            },
          },
          {
            fecha,
            brakeDisc: {
              wagonUnitId: 'wagon-1',
              bogieCodigo: 'PB2',
              ejeNumero: 1,
              wagonUnit: {
                tipoCoche: 'MA1',
                numeroCoche: 101,
                tren: { numero: 6 },
              },
            },
          },
        ]),
      },
    };
    const service = new HistorialService(
      prisma as unknown as PrismaService,
      crearNewMeasurementHistoryFake([]) as never,
    );

    const eventos = await service.listar({});

    const cambios = eventos.filter((e) => e.tipo === 'CAMBIO_DISCO');
    expect(cambios).toHaveLength(1);
    expect(cambios[0]).toMatchObject({ trenNumero: 6, ejeNumero: 1 });
  });

  it('solo cuenta fichas ficha_confirmada, separadas por motivo Medición/Reperfilado', async () => {
    const prisma = { inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) } };
    const newMeasurementHistory = crearNewMeasurementHistoryFake([
      { tipo: 'ficha_confirmada', trenNumero: 10, createdAt: '2026-05-01T00:00:00.000Z', motivo: 'Medición' },
      { tipo: 'ficha_bloqueada', trenNumero: 10, createdAt: '2026-05-01T00:00:00.000Z', motivo: 'Medición' },
      { tipo: 'ficha_confirmada', trenNumero: 11, createdAt: '2026-05-02T00:00:00.000Z', motivo: 'Reperfilado' },
    ]);
    const service = new HistorialService(
      prisma as unknown as PrismaService,
      newMeasurementHistory as never,
    );

    const eventos = await service.listar({});

    expect(eventos).toHaveLength(2);
    expect(eventos.find((e) => e.tipo === 'MEDICION')).toMatchObject({ trenNumero: 10 });
    expect(eventos.find((e) => e.tipo === 'REPERFILADO')).toMatchObject({ trenNumero: 11 });
  });

  it('kpis calcula total, última semana, trenes afectados y tipos diferentes', async () => {
    const hoy = new Date();
    const haceDosDias = new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const haceUnMes = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const prisma = { inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) } };
    const newMeasurementHistory = crearNewMeasurementHistoryFake([
      { tipo: 'ficha_confirmada', trenNumero: 10, createdAt: haceDosDias, motivo: 'Medición' },
      { tipo: 'ficha_confirmada', trenNumero: 11, createdAt: haceUnMes, motivo: 'Reperfilado' },
    ]);
    const service = new HistorialService(
      prisma as unknown as PrismaService,
      newMeasurementHistory as never,
    );

    const kpis = await service.kpis({});

    expect(kpis.total).toBe(2);
    expect(kpis.ultimaSemana).toBe(1);
    expect(kpis.trenesAfectados).toBe(2);
    expect(kpis.tiposDiferentes).toBe(2);
  });

  it('filtra por tren', async () => {
    const prisma = { inventoryMovement: { findMany: jest.fn().mockResolvedValue([]) } };
    const newMeasurementHistory = crearNewMeasurementHistoryFake([
      { tipo: 'ficha_confirmada', trenNumero: 10, createdAt: '2026-05-01T00:00:00.000Z', motivo: 'Medición' },
      { tipo: 'ficha_confirmada', trenNumero: 11, createdAt: '2026-05-02T00:00:00.000Z', motivo: 'Medición' },
    ]);
    const service = new HistorialService(
      prisma as unknown as PrismaService,
      newMeasurementHistory as never,
    );

    const eventos = await service.listar({ tren: 11 });

    expect(eventos).toHaveLength(1);
    expect(eventos[0].trenNumero).toBe(11);
  });
});
