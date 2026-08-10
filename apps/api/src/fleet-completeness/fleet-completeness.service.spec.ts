import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { FleetCompletenessService } from './fleet-completeness.service';

type Registro = Record<string, unknown>;

function disco(overrides: Registro = {}): Registro {
  return {
    id: 'disco-1',
    bogieCodigo: 'PB3',
    ejeNumero: 1,
    lado: 'izquierdo',
    ruedaNumero: 1,
    activo: true,
    wagonUnit: {
      tipoCoche: 'MA1',
      numeroCoche: 101,
      tren: { numero: 6 },
    },
    _count: { scanRecords: 0 },
    ...overrides,
  };
}

function crearPrisma(discos: Registro[]): PrismaService {
  return {
    brakeDisc: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        // Filtro mínimo suficiente para los tests: activo y, si viene,
        // wagonUnit.tren.numero.
        const trenFiltro = (
          where as {
            wagonUnit?: { tren?: { numero?: number } };
          }
        ).wagonUnit?.tren?.numero;
        return Promise.resolve(
          discos.filter((d) => {
            if (where.activo !== undefined && d.activo !== where.activo) {
              return false;
            }
            if (
              trenFiltro !== undefined &&
              (d.wagonUnit as { tren: { numero: number } }).tren.numero !==
                trenFiltro
            ) {
              return false;
            }
            return true;
          }),
        );
      }),
    },
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) => {
        const existe = discos.some(
          (d) =>
            (d.wagonUnit as { tren: { numero: number } }).tren.numero ===
            where.numero,
        );
        return Promise.resolve(existe ? { numero: where.numero } : null);
      }),
    },
  } as unknown as PrismaService;
}

describe('FleetCompletenessService', () => {
  describe('obtenerSummary', () => {
    it('detecta correctamente un disco sin ninguna medición (discosFaltantes lo cuenta, discosConAlMenosUnaMedicionHistorica no)', async () => {
      const prisma = crearPrisma([
        // Tren 6: 1 disco CON medición confirmada, 1 disco SIN ninguna.
        disco({
          id: 'd1',
          ejeNumero: 1,
          lado: 'izquierdo',
          _count: { scanRecords: 3 },
        }),
        disco({
          id: 'd2',
          ejeNumero: 1,
          lado: 'derecho',
          _count: { scanRecords: 0 },
        }),
      ]);
      const service = new FleetCompletenessService(prisma);

      const resultado = await service.obtenerSummary();

      expect(resultado.porTren).toEqual([
        {
          tren: 6,
          discosEsperados: 2,
          discosConAlMenosUnaMedicionHistorica: 1,
          discosFaltantes: 1,
        },
      ]);
      expect(resultado.total).toEqual({
        discosEsperados: 2,
        discosConAlMenosUnaMedicionHistorica: 1,
        discosFaltantes: 1,
      });
    });

    it('agrega el total across varios trenes', async () => {
      const prisma = crearPrisma([
        disco({
          id: 'd1',
          wagonUnit: {
            tipoCoche: 'MA1',
            numeroCoche: 101,
            tren: { numero: 6 },
          },
          _count: { scanRecords: 1 },
        }),
        disco({
          id: 'd2',
          wagonUnit: {
            tipoCoche: 'MA1',
            numeroCoche: 105,
            tren: { numero: 7 },
          },
          _count: { scanRecords: 0 },
        }),
      ]);
      const service = new FleetCompletenessService(prisma);

      const resultado = await service.obtenerSummary();

      expect(resultado.porTren.map((f) => f.tren)).toEqual([6, 7]);
      expect(resultado.total).toEqual({
        discosEsperados: 2,
        discosConAlMenosUnaMedicionHistorica: 1,
        discosFaltantes: 1,
      });
    });
  });

  describe('obtenerDetalle', () => {
    it('lista solo los discos SIN ninguna medición del tren pedido', async () => {
      const prisma = crearPrisma([
        disco({
          id: 'd1',
          ejeNumero: 1,
          lado: 'izquierdo',
          _count: { scanRecords: 2 },
        }),
        disco({
          id: 'd2',
          ejeNumero: 1,
          lado: 'derecho',
          _count: { scanRecords: 0 },
        }),
      ]);
      const service = new FleetCompletenessService(prisma);

      const detalle = await service.obtenerDetalle(6);

      expect(detalle).toEqual([
        {
          coche: 'MA1',
          numeroCoche: 101,
          bogie: 'PB3',
          eje: 1,
          lado: 'derecho',
        },
      ]);
    });

    it('tren inexistente -> NotFoundException', async () => {
      const prisma = crearPrisma([]);
      const service = new FleetCompletenessService(prisma);

      await expect(service.obtenerDetalle(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
