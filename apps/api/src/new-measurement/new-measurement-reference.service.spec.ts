import { NewMeasurementReferenceService } from './new-measurement-reference.service';

function crearEntorno(opts: {
  scanRecords?: unknown[];
  fichaConfirmada?: {
    id: string;
    uploadedFileId: string;
    trenNumero: number;
    kilometraje: number;
    fechaFicha: Date;
    responsableMantenimientoNombre: string | null;
  } | null;
}) {
  const tren32 = { id: 'tren-32', numero: 32, modelo: 'alstom_metropolis9000' };
  const scanRecords = opts.scanRecords ?? [];

  const prisma = {
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(where.numero === tren32.numero ? tren32 : null),
      ),
    },
    measurementSheet: {
      findFirst: jest.fn(() => Promise.resolve(opts.fichaConfirmada ?? null)),
    },
    scanRecord: {
      findMany: jest.fn(() => Promise.resolve(scanRecords)),
    },
    wagonUnit: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
  };

  return { prisma };
}

describe('NewMeasurementReferenceService.obtener — tipo=ultima_ficha', () => {
  it('responde disponible=false si el tren nunca tuvo ninguna ficha confirmada', async () => {
    const { prisma } = crearEntorno({ fichaConfirmada: null });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_ficha');

    expect(resultado).toEqual({ disponible: false });
  });

  it('con una ficha confirmada, devuelve la card con el responsable de la FICHA', async () => {
    const { prisma } = crearEntorno({
      fichaConfirmada: {
        id: 'ficha-1',
        uploadedFileId: 'file-1',
        trenNumero: 32,
        kilometraje: 130000,
        fechaFicha: new Date('2026-02-01'),
        responsableMantenimientoNombre: 'Juan Pérez',
      },
    });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_ficha');

    expect(resultado.disponible).toBe(true);
    if (resultado.disponible) {
      expect('fechaFicha' in resultado).toBe(true);
      if ('fechaFicha' in resultado) {
        expect(resultado.fechaFicha).toBe('2026-02-01');
        expect(resultado.kilometraje).toBe(130000);
        expect(resultado.responsable).toBe('Juan Pérez');
      }
    }
  });
});

describe('NewMeasurementReferenceService.obtener — tipo=ultima_medicion', () => {
  it('responde disponible=false si el tren nunca tuvo ninguna medición confirmada', async () => {
    const { prisma } = crearEntorno({ scanRecords: [] });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_medicion');

    expect(resultado).toEqual({ disponible: false });
  });
});
