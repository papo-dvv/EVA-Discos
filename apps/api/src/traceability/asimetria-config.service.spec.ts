import { Test } from '@nestjs/testing';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';
import { AsimetriaConfigService } from './asimetria-config.service';

describe('AsimetriaConfigService', () => {
  let service: AsimetriaConfigService;
  let systemParamsCache: { obtenerTodos: jest.Mock };

  beforeEach(async () => {
    systemParamsCache = { obtenerTodos: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AsimetriaConfigService,
        { provide: SystemParamsCacheService, useValue: systemParamsCache },
      ],
    }).compile();
    service = moduleRef.get(AsimetriaConfigService);
  });

  describe('obtenerUmbralSimetrica', () => {
    it('sin fila -> default 0.5', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(new Map());
      expect(await service.obtenerUmbralSimetrica()).toBe(0.5);
    });

    it('con fila configurada -> ese valor', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['asimetria_umbral_simetrica', '0.8']]),
      );
      expect(await service.obtenerUmbralSimetrica()).toBe(0.8);
    });

    it('valor no numérico -> default 0.5 (defensivo, nunca revienta)', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['asimetria_umbral_simetrica', 'no-numero']]),
      );
      expect(await service.obtenerUmbralSimetrica()).toBe(0.5);
    });
  });
});
