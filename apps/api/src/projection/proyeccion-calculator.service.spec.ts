import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import type { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { ProyeccionCalculatorService } from './proyeccion-calculator.service';
import type { ProyeccionRateService } from './proyeccion-rate.service';

const DISCO_FIXTURE = {
  id: 'disco-1',
  bogieCodigo: 'PB3',
  ejeNumero: 1,
  lado: 'izquierdo',
  wagonUnit: { tipoCoche: 'MA1', numeroCoche: 101 },
};

function crearPrisma(overrides: { disco?: unknown; ultimaMedicion?: unknown }) {
  return {
    brakeDisc: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.disco === undefined ? DISCO_FIXTURE : overrides.disco,
        ),
    },
    scanRecord: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.ultimaMedicion === undefined
          ? {
              fecha: new Date('2026-01-01T00:00:00.000Z'),
              hValue: 0.2,
              tValue: 5.2,
              rdValue: 5.0,
              motivo: 'Medición',
              responsableNombre: 'Responsable Test',
            }
          : overrides.ultimaMedicion,
      ),
    },
  } as unknown as PrismaService;
}

function crearBrakeDiscRules() {
  return {
    obtenerUmbrales: jest.fn().mockResolvedValue(UMBRALES_POR_DEFECTO),
  } as unknown as BrakeDiscRulesService;
}

// Devuelve también el mock suelto (no solo el service casteado) para poder
// aserter sobre él sin disparar @typescript-eslint/unbound-method (acceder a
// un método de una clase real vía la instancia casteada cuenta como "unbound
// method" aunque en runtime sea un jest.fn()).
function crearRate(tasa: number | null) {
  const calcularTasaPromedioPorTipoCoche = jest.fn().mockResolvedValue(tasa);
  return {
    rate: {
      calcularTasaPromedioPorTipoCoche,
    } as unknown as ProyeccionRateService,
    calcularTasaPromedioPorTipoCoche,
  };
}

describe('ProyeccionCalculatorService.proyectarDisco', () => {
  it('disco inexistente -> NotFoundException', async () => {
    const service = new ProyeccionCalculatorService(
      crearPrisma({ disco: null }),
      crearRate(0.25).rate,
      crearBrakeDiscRules(),
    );
    await expect(service.proyectarDisco('no-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('disco sin ninguna medición confirmada -> null', async () => {
    const service = new ProyeccionCalculatorService(
      crearPrisma({ ultimaMedicion: null }),
      crearRate(0.25).rate,
      crearBrakeDiscRules(),
    );
    expect(await service.proyectarDisco('disco-1')).toBeNull();
  });

  it('sin tasa de desgaste para el tipo de coche -> proyectable:false con motivo claro, sin ciclos', async () => {
    const service = new ProyeccionCalculatorService(
      crearPrisma({}),
      crearRate(null).rate,
      crearBrakeDiscRules(),
    );
    const resultado = await service.proyectarDisco('disco-1');

    expect(resultado).not.toBeNull();
    expect(resultado!.proyectable).toBe(false);
    expect(resultado!.motivo).toContain('MA1');
    expect(resultado!.ciclosReperfilado).toEqual([]);
    expect(resultado!.cicloCambio).toBeNull();
    expect(resultado!.truncado).toBe(false);
    // Los datos ACTUALES (medición real) igual viajan, no se pierden.
    expect(resultado!.h).toBe(0.2);
    expect(resultado!.rd).toBe(5.0);
  });

  it('con tasa disponible -> proyecta ciclos y expone estado/posición/h/t/rd', async () => {
    const service = new ProyeccionCalculatorService(
      crearPrisma({}),
      crearRate(0.25).rate,
      crearBrakeDiscRules(),
    );
    const resultado = await service.proyectarDisco('disco-1');

    expect(resultado!.proyectable).toBe(true);
    expect(resultado!.motivo).toBeNull();
    expect(resultado!.posicion).toEqual({
      tipoCoche: 'MA1',
      numeroCoche: 101,
      bogieCodigo: 'PB3',
      ejeNumero: 1,
      lado: 'izquierdo',
    });
    expect(resultado!.h).toBe(0.2);
    expect(resultado!.t).toBe(5.2);
    expect(resultado!.rd).toBe(5.0);
    // rd=5.0 >= rd_umbral_ok (1.0) y h=0.2 < h_umbral_reperfilado (1.6) -> OK.
    expect(resultado!.estado).toBe('OK');
    expect(resultado!.ciclosReperfilado.length).toBeGreaterThan(0);
    expect(resultado!.ciclosReperfilado[0].numero).toBe(1);
  });

  it('usa el mapa de tasas precomputado si se pasa, sin volver a consultar ProyeccionRateService', async () => {
    const { rate, calcularTasaPromedioPorTipoCoche } = crearRate(999); // si se llamara, este valor delataría el bug
    const service = new ProyeccionCalculatorService(
      crearPrisma({}),
      rate,
      crearBrakeDiscRules(),
    );
    await service.proyectarDisco('disco-1', { MA1: 0.25 });

    expect(calcularTasaPromedioPorTipoCoche).not.toHaveBeenCalled();
  });

  it('tasa null en el mapa precomputado -> proyectable:false igual que sin mapa', async () => {
    const service = new ProyeccionCalculatorService(
      crearPrisma({}),
      crearRate(999).rate,
      crearBrakeDiscRules(),
    );
    const resultado = await service.proyectarDisco('disco-1', { MA1: null });
    expect(resultado!.proyectable).toBe(false);
  });
});
