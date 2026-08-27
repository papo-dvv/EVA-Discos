import { Test } from '@nestjs/testing';
import { SystemParamsCacheService } from '../system-params/system-params-cache.service';
import {
  ConsensoConfigService,
  esClavePercentil,
} from './consenso-config.service';

describe('esClavePercentil', () => {
  it('true para los 4 parámetros de percentil', () => {
    expect(esClavePercentil('percentil_limite_inferior')).toBe(true);
    expect(esClavePercentil('percentil_limite_superior')).toBe(true);
    expect(esClavePercentil('percentil_extremo_inferior')).toBe(true);
    expect(esClavePercentil('percentil_extremo_superior')).toBe(true);
  });

  it('false para consenso_extremo_epsilon (cambiarlo no afecta gauss/percentiles/tukey)', () => {
    expect(esClavePercentil('consenso_extremo_epsilon')).toBe(false);
  });

  it('false para cualquier otra clave', () => {
    expect(esClavePercentil('rd_umbral_ok')).toBe(false);
    expect(esClavePercentil('outlier_metodo')).toBe(false);
  });
});

describe('ConsensoConfigService', () => {
  let service: ConsensoConfigService;
  let systemParamsCache: { obtenerTodos: jest.Mock };

  beforeEach(async () => {
    systemParamsCache = { obtenerTodos: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsensoConfigService,
        { provide: SystemParamsCacheService, useValue: systemParamsCache },
      ],
    }).compile();
    service = moduleRef.get(ConsensoConfigService);
  });

  describe('obtenerFracciones', () => {
    it('sin filas en system_params -> defaults P25/P75/P10/P90 en fracción 0..1', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(new Map());

      const fracciones = await service.obtenerFracciones();

      expect(fracciones).toEqual({
        limiteInferior: 0.25,
        limiteSuperior: 0.75,
        extremoInferior: 0.1,
        extremoSuperior: 0.9,
      });
    });

    it('con las 4 filas configuradas -> usa esos valores (÷100)', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([
          ['percentil_limite_inferior', '25'],
          ['percentil_limite_superior', '75'],
          ['percentil_extremo_inferior', '5'],
          ['percentil_extremo_superior', '95'],
        ]),
      );

      const fracciones = await service.obtenerFracciones();

      expect(fracciones).toEqual({
        limiteInferior: 0.25,
        limiteSuperior: 0.75,
        extremoInferior: 0.05,
        extremoSuperior: 0.95,
      });
    });

    it('valor no numérico en una fila -> cae al default de ESA clave, no rompe las demás', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([
          ['percentil_limite_inferior', 'no-numero'],
          ['percentil_limite_superior', '75'],
        ]),
      );

      const fracciones = await service.obtenerFracciones();

      expect(fracciones.limiteInferior).toBe(0.25); // default
      expect(fracciones.limiteSuperior).toBe(0.75); // configurado
    });
  });

  describe('obtenerEpsilon', () => {
    it('sin fila -> default 0.001', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(new Map());
      expect(await service.obtenerEpsilon()).toBe(0.001);
    });

    it('con fila configurada -> ese valor', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['consenso_extremo_epsilon', '0.005']]),
      );
      expect(await service.obtenerEpsilon()).toBe(0.005);
    });
  });

  describe('obtenerFraccionesConCandidato', () => {
    it('reemplaza SOLO la fracción de la clave que está cambiando', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([
          ['percentil_limite_inferior', '20'],
          ['percentil_limite_superior', '60'],
          ['percentil_extremo_inferior', '10'],
          ['percentil_extremo_superior', '90'],
        ]),
      );

      const fracciones = await service.obtenerFraccionesConCandidato(
        'percentil_limite_inferior',
        '35',
      );

      expect(fracciones).toEqual({
        limiteInferior: 0.35, // candidato, todavía no persistido
        limiteSuperior: 0.6, // resto sin cambios
        extremoInferior: 0.1,
        extremoSuperior: 0.9,
      });
    });
  });

  describe('obtenerAmplitudMaximaExtremo', () => {
    it('sin fila -> null (sin restricción activa)', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(new Map());
      expect(await service.obtenerAmplitudMaximaExtremo()).toBeNull();
    });

    it('fila con valor vacío -> null (así se representa "sin restricción" en una columna NOT NULL)', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['amplitud_maxima_extremo', '']]),
      );
      expect(await service.obtenerAmplitudMaximaExtremo()).toBeNull();
    });

    it('fila con valor no numérico -> null (defensivo, nunca revienta)', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['amplitud_maxima_extremo', 'no-numero']]),
      );
      expect(await service.obtenerAmplitudMaximaExtremo()).toBeNull();
    });

    it('fila configurada -> ese valor numérico', async () => {
      systemParamsCache.obtenerTodos.mockResolvedValue(
        new Map([['amplitud_maxima_extremo', '0.3']]),
      );
      expect(await service.obtenerAmplitudMaximaExtremo()).toBe(0.3);
    });
  });
});
