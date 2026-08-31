import type { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

interface FakeMovimiento {
  fecha: Date;
  brakeDisc: {
    wagonUnitId: string | null;
    bogieCodigo: string | null;
    ejeNumero: number | null;
  };
}

function crearPrismaFake(movimientos: FakeMovimiento[]) {
  const findMany = jest.fn().mockResolvedValue(movimientos);
  return {
    prisma: {
      inventoryMovement: { findMany },
    } as unknown as PrismaService,
    findMany,
  };
}

function movimiento(overrides: Partial<FakeMovimiento> = {}): FakeMovimiento {
  return {
    fecha: new Date(`${new Date().getUTCFullYear()}-03-10`),
    brakeDisc: { wagonUnitId: 'wagon-1', bogieCodigo: 'PB2', ejeNumero: 1 },
    ...overrides,
  };
}

describe('InventoryService.obtenerCambiosRealesPorMes', () => {
  it('un eje cambiado (2 discos, 2 filas de InventoryMovement) cuenta 1 vez, no 2', async () => {
    const { prisma } = crearPrismaFake([
      // Mismo eje: 2 InventoryMovement (uno por disco/lado montado), misma
      // posición física — debe deduplicarse a 1 solo cambio real.
      movimiento(),
      movimiento(),
    ]);

    const resultado = await new InventoryService(prisma).obtenerCambiosRealesPorMes();

    const marzo = resultado.find((p) => p.mes.endsWith('-03'));
    expect(marzo?.cambiosReales).toBe(1);
  });

  it('2 ejes distintos cambiados en el mismo mes cuentan 2, no 4', async () => {
    const { prisma } = crearPrismaFake([
      movimiento({ brakeDisc: { wagonUnitId: 'wagon-1', bogieCodigo: 'PB2', ejeNumero: 1 } }),
      movimiento({ brakeDisc: { wagonUnitId: 'wagon-1', bogieCodigo: 'PB2', ejeNumero: 1 } }),
      movimiento({ brakeDisc: { wagonUnitId: 'wagon-1', bogieCodigo: 'PB2', ejeNumero: 2 } }),
      movimiento({ brakeDisc: { wagonUnitId: 'wagon-1', bogieCodigo: 'PB2', ejeNumero: 2 } }),
    ]);

    const resultado = await new InventoryService(prisma).obtenerCambiosRealesPorMes();

    const marzo = resultado.find((p) => p.mes.endsWith('-03'));
    expect(marzo?.cambiosReales).toBe(2);
  });

  it('meses sin ningún cambio devuelven 0 explícito (12 filas siempre)', async () => {
    const { prisma } = crearPrismaFake([]);

    const resultado = await new InventoryService(prisma).obtenerCambiosRealesPorMes();

    expect(resultado).toHaveLength(12);
    expect(resultado.every((p) => p.cambiosReales === 0)).toBe(true);
  });
});
