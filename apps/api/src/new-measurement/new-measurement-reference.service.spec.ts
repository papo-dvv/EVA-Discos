import { NewMeasurementReferenceService } from './new-measurement-reference.service';

function crearEntorno(opts: {
  scanRecords?: unknown[];
  discos?: unknown[];
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
    brakeDisc: {
      findMany: jest.fn(() => Promise.resolve(opts.discos ?? [])),
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

  function scanRecordBase(overrides: Partial<Record<string, unknown>>) {
    return {
      id: 'sr-1',
      discId: 'disco-1',
      responsableNombre: 'Dominic Arrunategui',
      trenNumero: 32,
      kilometraje: 1165830,
      fecha: new Date('2026-06-16'),
      motivo: 'Medición',
      tValue: 25,
      hValue: 24,
      rdValue: 1,
      estadoCalculado: 'OK',
      estadoSugeridoExcel: null,
      corregidoPorHoja: false,
      trenOriginalExcel: null,
      discrepanciaEstadoExcel: false,
      hojaExcelOrigen: null,
      cocheExcel: null,
      numeroCocheExcel: null,
      bogieExcel: null,
      ejeExcel: null,
      ruedaExcel: null,
      ubicacionExcel: null,
      observacion: null,
      tInvalido: false,
      rdInvalido: false,
      ...overrides,
    };
  }

  // Caso real reportado (Tren 32, 2026-06-16): el header de la comparativa
  // (fecha/km/responsable) salía bien, pero la tabla de mediciones venía
  // vacía. Causa: el historial migrado en bloque desde Excel guarda
  // ubicacion_excel como texto libre ("disco_freno_..._izquierdo"/"...derecho",
  // ver schema.prisma), no el 'izquierdo'/'derecho' canónico que el frontend
  // usa para juntar cada fila con su posición del esqueleto (clave eje|lado —
  // ver construirFilasEspejo). El fix resuelve eje/lado desde el BrakeDisc
  // real (disc_id), no desde ese texto.
  it('normaliza eje/lado desde el BrakeDisc real cuando ubicacionExcel es texto libre migrado del Excel', async () => {
    const scanRecords = [
      scanRecordBase({
        id: 'sr-1',
        discId: 'disco-1',
        ejeExcel: 22,
        ubicacionExcel: 'disco_freno_22_derecho',
      }),
    ];
    const discos = [{ id: 'disco-1', ejeNumero: 22, lado: 'derecho' }];
    const { prisma } = crearEntorno({ scanRecords, discos });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_medicion');

    expect(resultado.disponible).toBe(true);
    if (resultado.disponible && 'rows' in resultado) {
      expect(resultado.rows).toHaveLength(1);
      expect(resultado.rows[0].ejeExcel).toBe(22);
      expect(resultado.rows[0].ubicacionExcel).toBe('derecho');
    }
  });

  it('conserva ejeExcel/ubicacionExcel tal cual cuando ya vienen canónicos (fichas de NewMeasurementModule)', async () => {
    const scanRecords = [
      scanRecordBase({
        id: 'sr-1',
        discId: 'disco-1',
        ejeExcel: 5,
        ubicacionExcel: 'izquierdo',
      }),
    ];
    const discos = [{ id: 'disco-1', ejeNumero: 5, lado: 'izquierdo' }];
    const { prisma } = crearEntorno({ scanRecords, discos });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_medicion');

    expect(resultado.disponible).toBe(true);
    if (resultado.disponible && 'rows' in resultado) {
      expect(resultado.rows[0].ejeExcel).toBe(5);
      expect(resultado.rows[0].ubicacionExcel).toBe('izquierdo');
    }
  });

  it('se queda con la medición más reciente de CADA disco aunque no compartan la misma fecha', async () => {
    const scanRecords = [
      // Ya ordenados desc por fecha (mismo criterio que produce el orderBy de
      // Prisma real) — disco-1 tiene 2 mediciones, disco-2 solo 1, en fechas
      // distintas entre sí.
      scanRecordBase({
        id: 'sr-recent-1',
        discId: 'disco-1',
        fecha: new Date('2026-06-16'),
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        tValue: 20,
      }),
      scanRecordBase({
        id: 'sr-old-1',
        discId: 'disco-1',
        fecha: new Date('2026-01-01'),
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        tValue: 25,
      }),
      scanRecordBase({
        id: 'sr-recent-2',
        discId: 'disco-2',
        fecha: new Date('2026-03-10'),
        ejeExcel: 1,
        ubicacionExcel: 'derecho',
        tValue: 22,
      }),
    ];
    const discos = [
      { id: 'disco-1', ejeNumero: 1, lado: 'izquierdo' },
      { id: 'disco-2', ejeNumero: 1, lado: 'derecho' },
    ];
    const { prisma } = crearEntorno({ scanRecords, discos });
    const service = new NewMeasurementReferenceService(prisma as never);

    const resultado = await service.obtener(32, 'ultima_medicion');

    expect(resultado.disponible).toBe(true);
    if (resultado.disponible && 'rows' in resultado) {
      expect(resultado.rows).toHaveLength(2);
      const filaDisco1 = resultado.rows.find((r) => r.discId === 'disco-1');
      expect(filaDisco1?.id).toBe('sr-recent-1');
      expect(filaDisco1?.tValue).toBe(20);
      const filaDisco2 = resultado.rows.find((r) => r.discId === 'disco-2');
      expect(filaDisco2?.id).toBe('sr-recent-2');
    }
  });
});
