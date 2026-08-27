import { Test } from '@nestjs/testing';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';
import { ProyeccionConfigService } from './proyeccion-config.service';

describe('ProyeccionConfigService', () => {
  let service: ProyeccionConfigService;
  let systemParamsCache: { obtenerTodos: jest.Mock };

  beforeEach(async () => {
    systemParamsCache = { obtenerTodos: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProyeccionConfigService,
        { provide: SystemParamsCacheService, useValue: systemParamsCache },
      ],
    }).compile();
    service = moduleRef.get(ProyeccionConfigService);
  });

  describe('obtenerRangoKm', () => {
    it('sin filas -> defaults 7000/15000', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(new Map());
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 7000,
        kmMax: 15000,
      });
    });

    it('con filas configuradas -> esos valores', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([
          ['proyeccion_km_rango_min', '5000'],
          ['proyeccion_km_rango_max', '20000'],
        ]),
      );
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 5000,
        kmMax: 20000,
      });
    });

    it('valor no numérico -> cae al default de esa clave, la otra se respeta', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([
          ['proyeccion_km_rango_min', 'no-numero'],
          ['proyeccion_km_rango_max', '18000'],
        ]),
      );
      expect(await service.obtenerRangoKm()).toEqual({
        kmMin: 7000,
        kmMax: 18000,
      });
    });
  });
});
