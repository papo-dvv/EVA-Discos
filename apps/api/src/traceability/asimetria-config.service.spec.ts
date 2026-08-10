import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AsimetriaConfigService } from './asimetria-config.service';

interface PrismaMock {
  systemParam: Record<'findUnique', jest.Mock>;
}

describe('AsimetriaConfigService', () => {
  let service: AsimetriaConfigService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      systemParam: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AsimetriaConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AsimetriaConfigService);
  });

  describe('obtenerUmbralSimetrica', () => {
    it('sin fila -> default 0.5', async () => {
      prisma.systemParam.findUnique.mockResolvedValue(null);
      expect(await service.obtenerUmbralSimetrica()).toBe(0.5);
    });

    it('con fila configurada -> ese valor', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({ valor: '0.8' });
      expect(await service.obtenerUmbralSimetrica()).toBe(0.8);
    });

    it('valor no numérico -> default 0.5 (defensivo, nunca revienta)', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({ valor: 'no-numero' });
      expect(await service.obtenerUmbralSimetrica()).toBe(0.5);
    });
  });
});
