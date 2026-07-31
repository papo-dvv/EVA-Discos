import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WearRateService } from '../wear-rate/wear-rate.service';
import { MigrationCommitService } from './migration-commit.service';

interface FakeScanRecord {
  id: string;
  fileId: string;
  discId: string | null;
  trenNumero: number;
  hojaExcelOrigen: string | null;
  cocheExcel: string | null;
  numeroCocheExcel: number | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  ruedaExcel: number | null;
}

interface FakeWagonUnit {
  id: string;
  numeroCoche: number;
  tipoCoche: string;
  trenId: string;
}

interface FakeBrakeDisc {
  id: string;
  wagonUnitId: string;
  bogieCodigo: string;
  ejeNumero: number;
  lado: string;
  ruedaNumero: number | null;
}

interface FakeUploadedFile {
  id: string;
  tipoCarga: string;
  status: string;
  commitLotesTotal: number | null;
  commitLotesCompletados: number;
  commitError: string | null;
}

interface ClaveBrakeDisc {
  wagonUnitId: string;
  bogieCodigo: string;
  ejeNumero: number;
  lado: string;
}

// Forma heterogénea de `data` en los distintos updates de UploadedFile que
// hace el servicio: campos planos, o commitLotesCompletados como
// { increment } dentro de la transacción corta de cada lote.
interface DatosActualizarArchivo {
  status?: string;
  commitLotesTotal?: number | null;
  commitLotesCompletados?: number | { increment: number };
  commitError?: string | null;
}

interface DatosScanEditLog {
  fileId: string;
  etapa: string;
  campoEditado: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  usuarioId: string;
}

// Fake de PrismaService con estado en memoria real (no solo jest.fn ciegos):
// permite verificar, entre dos llamadas independientes a confirmar()
// (simulando un reintento tras una caída), que el catálogo y el progreso
// persisten tal como lo haría Postgres entre dos requests HTTP distintos.
function crearEntorno(overridesArchivo: Partial<FakeUploadedFile> = {}) {
  let archivo: FakeUploadedFile = {
    id: 'file-1',
    tipoCarga: 'migracion_masiva_excel',
    status: 'review',
    commitLotesTotal: null,
    commitLotesCompletados: 0,
    commitError: null,
    ...overridesArchivo,
  };
  let scanRecords: FakeScanRecord[] = [];
  const wagonUnits: FakeWagonUnit[] = [];
  const brakeDiscs: FakeBrakeDisc[] = [];
  const trenes = [
    { id: 'tren-6', numero: 6 },
    { id: 'tren-7', numero: 7 },
  ];
  const bogies = [{ codigo: 'PB2' }, { codigo: 'PB6' }];

  let idSeq = 0;
  const nuevoId = (prefijo: string) => `${prefijo}-${++idSeq}`;

  let numeroTransaccion = 0;
  let fallarEnTransaccion: number | null = null;

  // Todos los métodos devuelven Promise.resolve(...) (no valores planos): el
  // servicio encadena `.catch(...)` sobre alguno de estos calls (ver
  // manejo de fallo de lote en confirmar()), igual que haría el Prisma real.
  const wagonUnitApi = {
    findUnique: jest.fn(
      ({
        where,
      }: {
        where: { numeroCoche: number };
      }): Promise<FakeWagonUnit | null> =>
        Promise.resolve(
          wagonUnits.find((w) => w.numeroCoche === where.numeroCoche) ?? null,
        ),
    ),
    create: jest.fn(
      ({
        data,
      }: {
        data: Omit<FakeWagonUnit, 'id'>;
      }): Promise<FakeWagonUnit> => {
        const nueva: FakeWagonUnit = { id: nuevoId('wagon'), ...data };
        wagonUnits.push(nueva);
        return Promise.resolve(nueva);
      },
    ),
  };

  const brakeDiscApi = {
    findUnique: jest.fn(
      ({
        where,
      }: {
        where: { wagonUnitId_bogieCodigo_ejeNumero_lado: ClaveBrakeDisc };
      }): Promise<FakeBrakeDisc | null> => {
        const k = where.wagonUnitId_bogieCodigo_ejeNumero_lado;
        return Promise.resolve(
          brakeDiscs.find(
            (d) =>
              d.wagonUnitId === k.wagonUnitId &&
              d.bogieCodigo === k.bogieCodigo &&
              d.ejeNumero === k.ejeNumero &&
              d.lado === k.lado,
          ) ?? null,
        );
      },
    ),
    create: jest.fn(
      ({
        data,
      }: {
        data: Omit<FakeBrakeDisc, 'id'>;
      }): Promise<FakeBrakeDisc> => {
        const nueva: FakeBrakeDisc = { id: nuevoId('disc'), ...data };
        brakeDiscs.push(nueva);
        return Promise.resolve(nueva);
      },
    ),
  };

  const scanRecordApi = {
    findMany: jest.fn(
      ({
        where,
      }: {
        where: { fileId: string; discId?: string | null };
      }): Promise<FakeScanRecord[]> =>
        Promise.resolve(
          scanRecords.filter(
            (r) =>
              r.fileId === where.fileId &&
              (where.discId === undefined || r.discId === where.discId),
          ),
        ),
    ),
    count: jest.fn(
      ({ where }: { where: { fileId: string } }): Promise<number> =>
        Promise.resolve(
          scanRecords.filter((r) => r.fileId === where.fileId).length,
        ),
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeScanRecord>;
      }): Promise<FakeScanRecord> => {
        const fila = scanRecords.find((r) => r.id === where.id);
        if (!fila) throw new Error(`fila ${where.id} no existe en el fake`);
        Object.assign(fila, data);
        return Promise.resolve({ ...fila });
      },
    ),
  };

  const uploadedFileApi = {
    findUnique: jest.fn((): Promise<FakeUploadedFile | null> =>
      Promise.resolve({ ...archivo }),
    ),
    update: jest.fn(
      ({
        data,
      }: {
        data: DatosActualizarArchivo;
      }): Promise<FakeUploadedFile> => {
        const cambios = { ...data };
        const inc = cambios.commitLotesCompletados;
        if (inc !== undefined && typeof inc === 'object') {
          cambios.commitLotesCompletados =
            archivo.commitLotesCompletados + inc.increment;
        }
        archivo = { ...archivo, ...cambios } as FakeUploadedFile;
        return Promise.resolve({ ...archivo });
      },
    ),
    delete: jest.fn((): Promise<FakeUploadedFile> =>
      Promise.resolve({ ...archivo }),
    ),
  };

  const scanEditLogApi = {
    create: jest.fn(
      ({ data }: { data: DatosScanEditLog }): Promise<DatosScanEditLog> =>
        Promise.resolve(data),
    ),
  };
  const trainApi = { findMany: jest.fn(() => Promise.resolve(trenes)) };
  const bogieCatalogApi = { findMany: jest.fn(() => Promise.resolve(bogies)) };

  // El "tx" de cada transacción corta es el mismo cliente fake: alcanza para
  // verificar comportamiento porque nuestro fake ya opera sobre el mismo
  // estado en memoria que representa la base de datos.
  const txCliente = {
    scanRecord: scanRecordApi,
    uploadedFile: uploadedFileApi,
    scanEditLog: scanEditLogApi,
  };

  const prisma = {
    uploadedFile: uploadedFileApi,
    scanRecord: scanRecordApi,
    train: trainApi,
    bogieCatalog: bogieCatalogApi,
    wagonUnit: wagonUnitApi,
    brakeDisc: brakeDiscApi,
    scanEditLog: scanEditLogApi,
    $transaction: jest.fn((fn: (tx: typeof txCliente) => unknown): unknown => {
      numeroTransaccion++;
      if (
        fallarEnTransaccion !== null &&
        numeroTransaccion === fallarEnTransaccion
      ) {
        throw new Error('P2028: Transaction already closed (simulado)');
      }
      return fn(txCliente);
    }),
  };

  return {
    prisma,
    wagonUnits,
    brakeDiscs,
    scanRecords: {
      set: (rows: FakeScanRecord[]) => {
        scanRecords = rows;
      },
      get: () => scanRecords,
    },
    archivo: {
      get: () => archivo,
    },
    forzarFalloEnTransaccion: (n: number | null) => {
      fallarEnTransaccion = n;
    },
  };
}

// La correctitud del cálculo de tasa de desgaste en sí (WearRateCalculatorService)
// y del recálculo incremental (WearRateService.recalcularParaDiscos) ya están
// cubiertas en sus propios specs; acá solo importa que MigrationCommitService
// lo invoque en el momento correcto, con un stub que no reviente.
async function construirServicio(
  prisma: unknown,
): Promise<MigrationCommitService> {
  const wearRateFake = {
    recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      MigrationCommitService,
      { provide: PrismaService, useValue: prisma },
      { provide: WearRateService, useValue: wearRateFake },
    ],
  }).compile();
  return moduleRef.get(MigrationCommitService);
}

function fila(overrides: Partial<FakeScanRecord> = {}): FakeScanRecord {
  return {
    id: 'row-1',
    fileId: 'file-1',
    discId: null,
    trenNumero: 6,
    hojaExcelOrigen: 'T06',
    cocheExcel: 'MA1',
    numeroCocheExcel: 129,
    bogieExcel: 'PB2',
    ejeExcel: 1,
    ubicacionExcel: 'izquierdo',
    ruedaExcel: 1,
    ...overrides,
  };
}

// Fila para el escenario a gran escala: solo 50 números de coche distintos
// (numeroCocheExcel cicla cada 50 filas) para que el mismo WagonUnit se
// reutilice a través de VARIOS lotes, pero ejeExcel es único por fila (0..N)
// así cada una es siempre un BrakeDisc distinto — evita colisiones de
// unicidad accidentales en los datos de prueba y aísla lo que se quiere
// probar: que el catálogo (coches) no se duplica entre lotes ni reintentos.
function filaGranEscala(i: number): FakeScanRecord {
  return {
    id: `g${i}`,
    fileId: 'file-1',
    discId: null,
    trenNumero: 6,
    hojaExcelOrigen: 'T06',
    cocheExcel: 'MA1',
    numeroCocheExcel: 100 + (i % 50),
    bogieExcel: i % 2 === 0 ? 'PB2' : 'PB6',
    ejeExcel: i,
    ubicacionExcel: i % 2 === 0 ? 'izquierdo' : 'derecho',
    ruedaExcel: i % 2 === 0 ? 2 : 1,
  };
}

describe('MigrationCommitService', () => {
  it('commit exitoso con varios trenes: resuelve coches y discos, marca committed', async () => {
    const entorno = crearEntorno();
    entorno.scanRecords.set([
      fila({
        id: 'r1',
        trenNumero: 6,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
      }),
      // Mismo coche 129, mismo eje/bogie, disco derecho -> reutiliza coche
      fila({
        id: 'r2',
        trenNumero: 6,
        ubicacionExcel: 'derecho',
        ruedaExcel: 2,
      }),
      // Coche 408 (tren 7), coche y disco nuevos
      fila({
        id: 'r3',
        trenNumero: 7,
        cocheExcel: 'MA2',
        numeroCocheExcel: 408,
        bogieExcel: 'PB6',
        ejeExcel: 3,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 7,
        hojaExcelOrigen: 'T07',
      }),
    ]);
    const service = await construirServicio(entorno.prisma);

    const res = await service.confirmar('file-1', 'admin-1');

    // 2 coches (129, 408), 3 discos (129-izq, 129-der, 408-izq)
    expect(entorno.wagonUnits.length).toBe(2);
    expect(entorno.brakeDiscs.length).toBe(3);
    expect(entorno.scanRecords.get().every((r) => r.discId !== null)).toBe(
      true,
    );
    expect(entorno.archivo.get().status).toBe('committed');
    const [[auditoria]] = entorno.prisma.scanEditLog.create.mock.calls;
    expect(auditoria.data.etapa).toBe('pre_commit');
    expect(auditoria.data.campoEditado).toBe('status_archivo');
    expect(auditoria.data.valorAnterior).toBe('review');
    expect(auditoria.data.valorNuevo).toBe('committed');

    expect(res).toEqual({
      fileId: 'file-1',
      status: 'committed',
      totalFilas: 3,
      cochesResueltos: 2,
      discosResueltos: 3,
      lotesCompletados: 1,
      lotesTotal: 1,
    });
  });

  it('reutiliza un coche/disco ya existente en la base sin volver a crearlo', async () => {
    const entorno = crearEntorno();
    entorno.wagonUnits.push({
      id: 'wagon-existente',
      numeroCoche: 129,
      tipoCoche: 'MA1',
      trenId: 'tren-6',
    });
    entorno.brakeDiscs.push({
      id: 'disc-existente',
      wagonUnitId: 'wagon-existente',
      bogieCodigo: 'PB2',
      ejeNumero: 1,
      lado: 'izquierdo',
      ruedaNumero: 1,
    });
    entorno.scanRecords.set([fila({ id: 'r1' })]);
    const service = await construirServicio(entorno.prisma);

    const res = await service.confirmar('file-1', 'admin-1');

    expect(entorno.wagonUnits.length).toBe(1);
    expect(entorno.brakeDiscs.length).toBe(1);
    expect(entorno.scanRecords.get()[0].discId).toBe('disc-existente');
    expect(res.cochesResueltos).toBe(0);
    expect(res.discosResueltos).toBe(0);
  });

  it('si una fila falla la resolución de catálogo, aborta ANTES de tocar ScanRecord o el status del archivo', async () => {
    const entorno = crearEntorno();
    entorno.scanRecords.set([
      fila({ id: 'r1' }), // válida, se procesa primero -> su coche/disco SÍ se crean
      fila({ id: 'r2', bogieExcel: 'ZZZ' }), // bogie inexistente -> falla
    ]);
    const service = await construirServicio(entorno.prisma);

    await expect(service.confirmar('file-1', 'admin-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    // El archivo NUNCA pasó a 'committing': FASE 1 corre completa ANTES de
    // tocar el status, así que sigue en 'review' y las filas siguen
    // editables (a diferencia del diseño anterior de transacción única).
    expect(entorno.archivo.get().status).toBe('review');
    expect(entorno.scanRecords.get().every((r) => r.discId === null)).toBe(
      true,
    );

    // Cambio de comportamiento DELIBERADO vs. el diseño anterior: el coche de
    // r1 (fila válida, procesada antes de la que falla) queda creado — ya no
    // hay una única transacción que revierta todo. Es catálogo real y se
    // reutiliza (no se duplica) en el reintento tras corregir r2.
    expect(entorno.wagonUnits.length).toBe(1);
  });

  it('falla (422) si el tren no existe en el catálogo', async () => {
    const entorno = crearEntorno();
    entorno.scanRecords.set([fila({ id: 'r1', trenNumero: 99 })]);
    const service = await construirServicio(entorno.prisma);

    await expect(service.confirmar('file-1', 'admin-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(entorno.archivo.get().status).toBe('review');
  });

  it('lanza NotFound si el archivo no es una carga de migración', async () => {
    const entorno = crearEntorno({ tipoCarga: 'csv_individual' });
    entorno.scanRecords.set([fila({ id: 'r1' })]);
    const service = await construirServicio(entorno.prisma);

    await expect(service.confirmar('file-1', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanza Conflict si el archivo ya está committed', async () => {
    const entorno = crearEntorno({ status: 'committed' });
    const service = await construirServicio(entorno.prisma);

    await expect(service.confirmar('file-1', 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lanza Conflict si el archivo está pendiente/procesando (aún no llegó a revisión)', async () => {
    const entorno = crearEntorno({ status: 'processing' });
    const service = await construirServicio(entorno.prisma);

    await expect(service.confirmar('file-1', 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  describe('confirmación por lotes a gran escala (FASE 1 + FASE 2)', () => {
    it('confirma 2000 filas en lotes de 500, sin una única transacción gigante', async () => {
      const entorno = crearEntorno();
      entorno.scanRecords.set(
        Array.from({ length: 2000 }, (_, i) => filaGranEscala(i)),
      );
      const service = await construirServicio(entorno.prisma);

      const res = await service.confirmar('file-1', 'admin-1');

      expect(res.status).toBe('committed');
      expect(res.totalFilas).toBe(2000);
      expect(res.lotesTotal).toBe(4); // 2000 / 500
      expect(res.lotesCompletados).toBe(4);
      expect(res.cochesResueltos).toBe(50); // numeroCocheExcel cicla cada 50 filas
      expect(res.discosResueltos).toBe(2000); // ejeExcel único por fila

      // 4 transacciones de lote + 1 de cierre = 5, nunca una que envuelva las
      // 2000 filas de una sola vez.
      const llamadas = entorno.prisma.$transaction.mock.calls;
      expect(llamadas).toHaveLength(5);
      for (const llamada of llamadas.slice(0, 4)) {
        expect(llamada[1]).toEqual({ timeout: 10_000 });
      }

      expect(entorno.archivo.get().commitLotesCompletados).toBe(4);
      expect(entorno.scanRecords.get().every((r) => r.discId !== null)).toBe(
        true,
      );
    });

    it('si un lote falla, los anteriores quedan confirmados; reintentar retoma sin duplicar catálogo', async () => {
      const entorno = crearEntorno();
      entorno.scanRecords.set(
        Array.from({ length: 2000 }, (_, i) => filaGranEscala(i)),
      );
      // El 2do lote (filas 500-999) falla, simulando un P2028/timeout.
      entorno.forzarFalloEnTransaccion(2);
      const service = await construirServicio(entorno.prisma);

      await expect(
        service.confirmar('file-1', 'admin-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      // Estado intermedio claro: NO 'committed'. El lote 1 sí quedó
      // confirmado (su transacción ya había cerrado exitosamente).
      expect(entorno.archivo.get().status).toBe('committing');
      expect(entorno.archivo.get().commitLotesTotal).toBe(4);
      expect(entorno.archivo.get().commitLotesCompletados).toBe(1);
      expect(entorno.archivo.get().commitError).toContain('P2028');

      const filas = entorno.scanRecords.get();
      expect(filas.slice(0, 500).every((f) => f.discId !== null)).toBe(true);
      expect(filas.slice(500).every((f) => f.discId === null)).toBe(true);

      // FASE 1 corrió sobre las 2000 filas pendientes ANTES de que arrancara
      // ningún lote (por diseño), así que el catálogo completo ya estaba
      // resuelto para cuando el lote 2 falló.
      const cochesTrasIntento1 = entorno.wagonUnits.length;
      const discosTrasIntento1 = entorno.brakeDiscs.length;
      expect(cochesTrasIntento1).toBe(50);
      expect(discosTrasIntento1).toBe(2000);

      // --- Reintento: esta vez sin fallas ---
      entorno.forzarFalloEnTransaccion(null);
      const res = await service.confirmar('file-1', 'admin-1');

      expect(res.status).toBe('committed');
      expect(res.lotesCompletados).toBe(4);
      // En el reintento no se resolvió catálogo nuevo: todo ya existía.
      expect(res.cochesResueltos).toBe(0);
      expect(res.discosResueltos).toBe(0);

      expect(entorno.archivo.get().commitLotesCompletados).toBe(4);
      expect(entorno.scanRecords.get().every((f) => f.discId !== null)).toBe(
        true,
      );

      // Ni un WagonUnit ni un BrakeDisc se duplicó por el reintento.
      expect(entorno.wagonUnits.length).toBe(cochesTrasIntento1);
      expect(entorno.brakeDiscs.length).toBe(discosTrasIntento1);
    });
  });

  describe('cancelar', () => {
    it('borra el archivo (borrador en review): cascade se encarga de scan_records/scan_edit_log', async () => {
      const entorno = crearEntorno({ status: 'review' });
      const service = await construirServicio(entorno.prisma);

      const res = await service.cancelar('file-1');

      expect(entorno.prisma.uploadedFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(res).toEqual({ fileId: 'file-1', cancelado: true });
    });

    it('rechaza con 409 si el archivo ya está committed, SIN borrar nada', async () => {
      const entorno = crearEntorno({ status: 'committed' });
      const service = await construirServicio(entorno.prisma);

      await expect(service.cancelar('file-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(entorno.prisma.uploadedFile.delete).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el archivo no existe o no es una carga de migración', async () => {
      const entorno = crearEntorno();
      entorno.prisma.uploadedFile.findUnique.mockResolvedValueOnce(null);
      const service = await construirServicio(entorno.prisma);

      await expect(service.cancelar('file-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(entorno.prisma.uploadedFile.delete).not.toHaveBeenCalled();
    });
  });
});
