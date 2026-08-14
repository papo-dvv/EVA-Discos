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
    responsableMantenimientoFirma?: string | null;
    responsableMantenimientoFecha?: Date | null;
    ingMrNombre?: string | null;
    ingMrFirma?: string | null;
    ingMrFecha?: Date | null;
    ptCodigo?: string | null;
  } | null;
  tecnicos?: unknown[];
  instrumentos?: unknown[];
}) {
  const tren32 = { id: 'tren-32', numero: 32, modelo: 'alstom_metropolis9000' };
  const scanRecords = opts.scanRecords ?? [];
  const fichaConfirmada = opts.fichaConfirmada
    ? {
        responsableMantenimientoFirma: null,
        responsableMantenimientoFecha: null,
        ingMrNombre: null,
        ingMrFirma: null,
        ingMrFecha: null,
        ptCodigo: null,
        ...opts.fichaConfirmada,
      }
    : null;

  const prisma = {
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(where.numero === tren32.numero ? tren32 : null),
      ),
    },
    measurementSheet: {
      findFirst: jest.fn(() => Promise.resolve(fichaConfirmada)),
    },
    measurementSheetTecnico: {
      findMany: jest.fn(() => Promise.resolve(opts.tecnicos ?? [])),
    },
    measurementSheetInstrumento: {
      findMany: jest.fn(() => Promise.resolve(opts.instrumentos ?? [])),
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

  // Punto 7 del enunciado (frontend): "Ficha Anterior" muestra, además de
  // card + tabla, Lista de Instrumentos y Realizado por/Ing. MR/Responsable
  // de Mantenimiento en solo lectura — necesita que el backend exponga esos
  // datos completos (antes solo viajaba `responsable`, el nombre nomás).
  it('con una ficha confirmada, expone técnicos/instrumentos y las firmas/fechas de Ing. MR y Responsable', async () => {
    const tecnicos = [
      { posicion: 1, nombre: 'Ana Gómez', firma: null, fecha: null },
    ];
    const instrumentos = [
      {
        posicion: 1,
        codigo: 'INST-01',
        descripcion: 'Calibre',
        modeloMarca: null,
        fechaCalibracion: null,
        fechaVencimientoCalibracion: null,
        observaciones: null,
      },
    ];
    const { prisma } = crearEntorno({
      fichaConfirmada: {
        id: 'ficha-1',
        uploadedFileId: 'file-1',
        trenNumero: 32,
        kilometraje: 130000,
        fechaFicha: new Date('2026-02-01'),
        responsableMantenimientoNombre: 'Juan Pérez',
        responsableMantenimientoFirma: 'firma-juan.png',
        responsableMantenimientoFecha: new Date('2026-02-01'),
        ingMrNombre: 'Carlos Ruiz',
        ingMrFirma: 'firma-carlos.png',
        ingMrFecha: new Date('2026-02-01'),
        ptCodigo: 'PT-77',
      },
      tecnicos,
      instrumentos,
    });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_ficha');

    expect(resultado.disponible).toBe(true);
    if (resultado.disponible && 'fechaFicha' in resultado) {
      expect(resultado.tecnicos).toEqual(tecnicos);
      expect(resultado.instrumentos).toEqual(instrumentos);
      expect(resultado.responsableMantenimientoFirma).toBe('firma-juan.png');
      expect(resultado.responsableMantenimientoFecha).toBe('2026-02-01');
      expect(resultado.ingMrNombre).toBe('Carlos Ruiz');
      expect(resultado.ingMrFirma).toBe('firma-carlos.png');
      expect(resultado.ingMrFecha).toBe('2026-02-01');
      expect(resultado.ptCodigo).toBe('PT-77');
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
