import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProyeccionConfigService } from './proyeccion-config.service';

interface PrismaMock {
  systemParam: Record<'findMany', jest.Mock>;
}

describe('ProyeccionConfigService', () => {
  let service: ProyeccionConfigService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      systemParam: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProyeccionConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ProyeccionConfigService);
  });

  describe('obtenerRangoKm', () => {
    it('sin filas -> defaults 7000/15000', async () => {
      prisma.systemParam.findMany.mockResolvedValue([]);
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 7000,
        kmMax: 15000,
      });
    });

    it('con filas configuradas -> esos valores', async () => {
      prisma.systemParam.findMany.mockResolvedValue([
        { clave: 'proyeccion_km_rango_min', valor: '5000' },
        { clave: 'proyeccion_km_rango_max', valor: '20000' },
      ]);
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 5000,
        kmMax: 20000,
      });
    });

    it('valor no numérico -> cae al default de esa clave, la otra se respeta', async () => {
      prisma.systemParam.findMany.mockResolvedValue([
        { clave: 'proyeccion_km_rango_min', valor: 'no-numero' },
        { clave: 'proyeccion_km_rango_max', valor: '18000' },
      ]);
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 7000,
        kmMax: 18000,
      });
    });
  });
});
