import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

interface PrismaMock {
  notification: Record<'findMany', jest.Mock>;
}

// mock.calls es any[][] sin este cast intermedio a unknown[][] -> indexarlo
// dispara no-unsafe-member-access (mismo patrón ya usado en
// system-params.service.spec.ts).
function primerArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = { notification: { findMany: jest.fn().mockResolvedValue([]) } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('busca notificaciones del usuario puntual O de su rol, más recientes primero', async () => {
    await service.listarPropias('user-1', 'administrador');

    const args = primerArg<{
      where: { OR: unknown[] };
      orderBy: { createdAt: string };
      take: number;
    }>(prisma.notification.findMany);
    expect(args.where.OR).toEqual([
      { userId: 'user-1' },
      { rolDestino: 'administrador' },
    ]);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(30);
  });

  it('devuelve tal cual lo que responde Prisma', async () => {
    const filas = [
      {
        id: 'n1',
        tipo: 'consenso_extremo_ajustado',
        severidad: 'advertencia',
        mensaje: 'Consenso ajustado para Tren 13 · MA1: ...',
        createdAt: new Date('2026-07-30T12:00:00Z'),
      },
    ];
    prisma.notification.findMany.mockResolvedValue(filas);

    const resultado = await service.listarPropias('user-1', 'administrador');

    expect(resultado).toEqual(filas);
  });
});
