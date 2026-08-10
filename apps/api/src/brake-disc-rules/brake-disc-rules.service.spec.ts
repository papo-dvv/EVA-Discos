import { Test } from '@nestjs/testing';
import { BrakeDiscRulesService } from './brake-disc-rules.service';
import { UmbralesProviderService } from './umbrales-provider.service';

describe('BrakeDiscRulesService', () => {
  let service: BrakeDiscRulesService;
  let umbralesProvider: { obtenerUmbrales: jest.Mock };

  beforeEach(async () => {
    umbralesProvider = { obtenerUmbrales: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BrakeDiscRulesService,
        { provide: UmbralesProviderService, useValue: umbralesProvider },
      ],
    }).compile();

    service = moduleRef.get(BrakeDiscRulesService);
  });

  it('calcularRd no consulta los umbrales (no los necesita)', () => {
    expect(service.calcularRd(12.4, 3.8)).toBeCloseTo(8.6);
    expect(umbralesProvider.obtenerUmbrales).not.toHaveBeenCalled();
  });

  it('clasificarEstado resuelve los umbrales inyectados y delega en el motor', async () => {
    umbralesProvider.obtenerUmbrales.mockResolvedValue({
      rdUmbralOk: 2.0,
      rdUmbralSeguimiento: 1.0,
      rdUmbralCritico: 0.0,
      hUmbralReperfilado: 1.6,
      reperfiladoDescuentoRd: 0.8,
    });

    // Con los umbrales por defecto 1.5 sería OK; con los umbrales devueltos acá, es Seguimiento.
    await expect(service.clasificarEstado(1.5)).resolves.toBe('SEGUIMIENTO');
    expect(umbralesProvider.obtenerUmbrales).toHaveBeenCalledTimes(1);
  });

  it('obtenerUmbrales devuelve los umbrales crudos, sin envolverlos en un motor', async () => {
    const umbrales = {
      rdUmbralOk: 2.0,
      rdUmbralSeguimiento: 1.0,
      rdUmbralCritico: 0.0,
      hUmbralReperfilado: 1.6,
      reperfiladoDescuentoRd: 0.8,
    };
    umbralesProvider.obtenerUmbrales.mockResolvedValue(umbrales);

    await expect(service.obtenerUmbrales()).resolves.toEqual(umbrales);
  });

  it('evaluarAccionRecomendada resuelve los umbrales inyectados y delega en el motor', async () => {
    umbralesProvider.obtenerUmbrales.mockResolvedValue({
      rdUmbralOk: 1.0,
      rdUmbralSeguimiento: 0.4,
      rdUmbralCritico: 0.0,
      hUmbralReperfilado: 1.6,
      reperfiladoDescuentoRd: 0.8,
    });

    await expect(
      service.evaluarAccionRecomendada(
        { rd: -0.1, h: 1.0 },
        { rd: 1.5, h: 1.0 },
      ),
    ).resolves.toEqual({ accion: 'CRITICO', ladoAfectado: 'ambos' });
    expect(umbralesProvider.obtenerUmbrales).toHaveBeenCalledTimes(1);
  });
});
