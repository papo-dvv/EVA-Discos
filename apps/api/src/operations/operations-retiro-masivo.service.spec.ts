import { ConflictException } from '@nestjs/common';
import { OperationsRetiroMasivoService } from './operations-retiro-masivo.service';
import type { RetiroMasivoDto } from './dto/retiro-masivo.dto';

interface FakeDisc {
  id: string;
  stage: string;
}

interface FakeMovement {
  brakeDiscId: string;
  operacionId: string;
  tipo: string;
  etapaOrigen: string;
  etapaDestino: string;
  encargadoNombre: string;
  encargadoFirma: string | null;
  supervisorNombre: string | null;
  numeroPt: string | null;
  justificacion: string | null;
  fecha: Date;
  realizadoPor: string;
}

// Fake de PrismaService con estado en memoria — mismo patrón que
// new-measurement-commit.service.spec.ts.
function crearEntorno(discos: FakeDisc[]) {
  let items = discos.map((d) => ({ ...d }));
  const movimientos: FakeMovement[] = [];

  const base = {
    brakeDisc: {
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: { in: string[] }; stage: string };
          data: { stage: string };
        }) => {
          let count = 0;
          items = items.map((d) => {
            if (where.id.in.includes(d.id) && d.stage === where.stage) {
              count += 1;
              return { ...d, stage: data.stage };
            }
            return d;
          });
          return Promise.resolve({ count });
        },
      ),
    },
    inventoryMovement: {
      createMany: jest.fn(({ data }: { data: FakeMovement[] }) => {
        movimientos.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };

  const prisma = {
    ...base,
    $transaction: jest.fn(
      (fn: (tx: typeof base) => Promise<unknown>) => fn(base),
      { timeout: 10_000 },
    ),
  };

  return { prisma, itemsRef: () => items, movimientos };
}

describe('OperationsRetiroMasivoService.retirar', () => {
  it('mueve los discos de almacén a taller y arrastra supervisor/PT/observaciones a cada movimiento', async () => {
    const { prisma, itemsRef, movimientos } = crearEntorno([
      { id: 'd1', stage: 'almacen' },
      { id: 'd2', stage: 'almacen' },
    ]);
    const service = new OperationsRetiroMasivoService(prisma as never);

    const dto: RetiroMasivoDto = {
      discIds: ['d1', 'd2'],
      encargadoNombre: 'Juan Pérez',
      supervisorNombre: 'María Gómez',
      numeroPt: 'PT-99',
      justificacion: 'Piezas con Rd bajo, retiro preventivo',
    };
    const resultado = await service.retirar(dto, 'user-1');

    expect(resultado.discosRetirados).toBe(2);
    expect(itemsRef().every((d) => d.stage === 'taller')).toBe(true);
    expect(movimientos).toHaveLength(2);
    expect(
      movimientos.every((m) => m.operacionId === resultado.operacionId),
    ).toBe(true);
    expect(movimientos.every((m) => m.supervisorNombre === 'María Gómez')).toBe(
      true,
    );
    expect(movimientos.every((m) => m.numeroPt === 'PT-99')).toBe(true);
    expect(
      movimientos.every(
        (m) => m.justificacion === 'Piezas con Rd bajo, retiro preventivo',
      ),
    ).toBe(true);
  });

  it('deja los campos opcionales en null cuando no vienen en el DTO', async () => {
    const { prisma, movimientos } = crearEntorno([
      { id: 'd1', stage: 'almacen' },
    ]);
    const service = new OperationsRetiroMasivoService(prisma as never);

    await service.retirar(
      { discIds: ['d1'], encargadoNombre: 'Juan Pérez' },
      'user-1',
    );

    expect(movimientos[0].supervisorNombre).toBeNull();
    expect(movimientos[0].numeroPt).toBeNull();
    expect(movimientos[0].justificacion).toBeNull();
  });

  it('lanza ConflictException si algún disco ya no está en almacén (carrera con otra operación)', async () => {
    const { prisma } = crearEntorno([
      { id: 'd1', stage: 'almacen' },
      { id: 'd2', stage: 'taller' },
    ]);
    const service = new OperationsRetiroMasivoService(prisma as never);

    await expect(
      service.retirar(
        { discIds: ['d1', 'd2'], encargadoNombre: 'Juan Pérez' },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });
});
