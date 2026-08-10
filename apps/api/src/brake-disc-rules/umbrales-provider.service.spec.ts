import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UMBRALES_POR_DEFECTO } from './umbrales';
import { UmbralesProviderService } from './umbrales-provider.service';

describe('UmbralesProviderService', () => {
  let service: UmbralesProviderService;
  let prisma: { systemParam: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { systemParam: { findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UmbralesProviderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(UmbralesProviderService);
  });

  it('usa los valores de la base cuando los 5 parámetros existen', async () => {
    prisma.systemParam.findMany.mockResolvedValue([
      { clave: 'rd_umbral_ok', valor: '1.20' },
      { clave: 'rd_umbral_seguimiento', valor: '0.50' },
      { clave: 'rd_umbral_critico', valor: '-0.05' },
      { clave: 'h_umbral_reperfilado', valor: '1.70' },
      { clave: 'reperfilado_descuento_rd', valor: '0.90' },
    ]);

    await expect(service.obtenerUmbrales()).resolves.toEqual({
      rdUmbralOk: 1.2,
      rdUmbralSeguimiento: 0.5,
      rdUmbralCritico: -0.05,
      hUmbralReperfilado: 1.7,
      reperfiladoDescuentoRd: 0.9,
    });
  });

  it('cae a los valores por defecto cuando no hay ninguna fila', async () => {
    prisma.systemParam.findMany.mockResolvedValue([]);

    await expect(service.obtenerUmbrales()).resolves.toEqual(
      UMBRALES_POR_DEFECTO,
    );
  });

  it('completa con el valor por defecto solo el parámetro que falta', async () => {
    prisma.systemParam.findMany.mockResolvedValue([
      { clave: 'rd_umbral_ok', valor: '1.20' },
      // rd_umbral_seguimiento no está en la base
      { clave: 'rd_umbral_critico', valor: '-0.05' },
      { clave: 'h_umbral_reperfilado', valor: '1.70' },
      { clave: 'reperfilado_descuento_rd', valor: '0.90' },
    ]);

    await expect(service.obtenerUmbrales()).resolves.toEqual({
      rdUmbralOk: 1.2,
      rdUmbralSeguimiento: UMBRALES_POR_DEFECTO.rdUmbralSeguimiento,
      rdUmbralCritico: -0.05,
      hUmbralReperfilado: 1.7,
      reperfiladoDescuentoRd: 0.9,
    });
  });

  it('cae al valor por defecto si el valor guardado no es un número válido', async () => {
    prisma.systemParam.findMany.mockResolvedValue([
      { clave: 'rd_umbral_ok', valor: 'no-es-un-numero' },
      { clave: 'rd_umbral_seguimiento', valor: '0.50' },
      { clave: 'rd_umbral_critico', valor: '-0.05' },
      { clave: 'h_umbral_reperfilado', valor: '1.70' },
      { clave: 'reperfilado_descuento_rd', valor: '0.90' },
    ]);

    await expect(service.obtenerUmbrales()).resolves.toEqual({
      rdUmbralOk: UMBRALES_POR_DEFECTO.rdUmbralOk,
      rdUmbralSeguimiento: 0.5,
      rdUmbralCritico: -0.05,
      hUmbralReperfilado: 1.7,
      reperfiladoDescuentoRd: 0.9,
    });
  });

  it('cae al valor por defecto (0.00) cuando rd_umbral_critico no está en la base', async () => {
    prisma.systemParam.findMany.mockResolvedValue([
      { clave: 'rd_umbral_ok', valor: '1.20' },
      { clave: 'rd_umbral_seguimiento', valor: '0.50' },
      { clave: 'h_umbral_reperfilado', valor: '1.70' },
      { clave: 'reperfilado_descuento_rd', valor: '0.90' },
    ]);

    await expect(service.obtenerUmbrales()).resolves.toEqual({
      rdUmbralOk: 1.2,
      rdUmbralSeguimiento: 0.5,
      rdUmbralCritico: UMBRALES_POR_DEFECTO.rdUmbralCritico,
      hUmbralReperfilado: 1.7,
      reperfiladoDescuentoRd: 0.9,
    });
  });
});
