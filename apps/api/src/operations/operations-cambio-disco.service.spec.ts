import { BadRequestException, ConflictException } from '@nestjs/common';
import { OperationsCambioDiscoService } from './operations-cambio-disco.service';
import type { CambioDiscoDto } from './dto/cambio-disco.dto';

interface FakeDisc {
  id: string;
  wagonUnitId: string | null;
  bogieCodigo: string | null;
  ejeNumero: number | null;
  lado: string | null;
  stage: string;
  fase: string;
}

// Fake de PrismaService con estado en memoria — mismo patrón que
// new-measurement-commit.service.spec.ts. Arma un coche con 4 ejes montados
// (PB3, ejes 1-4, izq+der = 8 discos en_servicio) y 4 pares completos en
// Taller listos para reemplazarlos.
function crearEntorno(opciones: { ocultarIds?: string[] } = {}) {
  const wagon = {
    id: 'wagon-1',
    numeroCoche: 201,
    trenId: 'tren-32',
    tipoCoche: 'MA1',
  };
  const tren = { numero: 32 };
  const ocultarIds = new Set(opciones.ocultarIds ?? []);

  let discos: FakeDisc[] = [];
  for (let eje = 1; eje <= 4; eje++) {
    for (const lado of ['izquierdo', 'derecho']) {
      if (ocultarIds.has(`viejo-e${eje}-${lado}`)) continue;
      discos.push({
        id: `viejo-e${eje}-${lado}`,
        wagonUnitId: wagon.id,
        bogieCodigo: 'PB3',
        ejeNumero: eje,
        lado,
        stage: 'en_servicio',
        fase: 'usada',
      });
      discos.push({
        id: `nuevo-e${eje}-${lado}`,
        wagonUnitId: null,
        bogieCodigo: 'PB3',
        ejeNumero: eje,
        lado,
        stage: 'taller',
        fase: 'nueva',
      });
    }
  }

  const archivos: unknown[] = [];
  const scanRecords: {
    id: string;
    discId: string;
    cocheExcel?: string | null;
    numeroCocheExcel?: number | null;
    bogieExcel?: string | null;
    ejeExcel?: number | null;
    ubicacionExcel?: string | null;
    ruedaExcel?: number | null;
    ordenFisico?: number;
  }[] = [];
  const movimientos: {
    brakeDiscId: string;
    etapaOrigen: string;
    etapaDestino: string;
    operacionId: string;
  }[] = [];
  let seqScan = 0;
  let seqArchivo = 0;

  const base = {
    wagonUnit: {
      findUnique: jest.fn(({ where }: { where: { numeroCoche: number } }) =>
        Promise.resolve(
          where.numeroCoche === wagon.numeroCoche ? { ...wagon, tren } : null,
        ),
      ),
    },
    uploadedFile: {
      create: jest.fn(({ data }: { data: unknown }) => {
        const archivo = { id: `archivo-${++seqArchivo}`, ...(data as object) };
        archivos.push(archivo);
        return Promise.resolve(archivo);
      }),
    },
    scanRecord: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: (typeof scanRecords)[number] }) => {
        const sr = { id: `sr-${++seqScan}`, ...data };
        scanRecords.push(sr);
        return Promise.resolve(sr);
      }),
    },
    brakeDisc: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            wagonUnitId: string;
            bogieCodigo: string;
            ejeNumero: number;
            lado: string;
            stage: string;
          };
        }) =>
          Promise.resolve(
            discos.find(
              (d) =>
                d.wagonUnitId === where.wagonUnitId &&
                d.bogieCodigo === where.bogieCodigo &&
                d.ejeNumero === where.ejeNumero &&
                d.lado === where.lado &&
                d.stage === where.stage,
            ) ?? null,
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(discos.find((d) => d.id === where.id) ?? null),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeDisc>;
        }) => {
          discos = discos.map((d) =>
            d.id === where.id ? { ...d, ...data } : d,
          );
          return Promise.resolve(discos.find((d) => d.id === where.id));
        },
      ),
    },
    inventoryMovement: {
      createMany: jest.fn(({ data }: { data: typeof movimientos }) => {
        movimientos.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };

  const prisma = {
    ...base,
    $transaction: jest.fn((fn: (tx: typeof base) => Promise<unknown>) =>
      fn(base),
    ),
  };

  const reglas = {
    obtenerEvaluador: jest.fn().mockResolvedValue({
      calcularRd: (t: number, h: number) => t - h,
      clasificarEstadoConReperfilado: () => 'OK',
    }),
  };
  const wearRate = {
    recalcularParaDiscos: jest.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    reglas,
    wearRate,
    discosRef: () => discos,
    archivosRef: () => archivos,
    scanRecordsRef: () => scanRecords,
    movimientosRef: () => movimientos,
  };
}

function crearServicio(entorno: ReturnType<typeof crearEntorno>) {
  return new OperationsCambioDiscoService(
    entorno.prisma as never,
    entorno.reglas as never,
    entorno.wearRate as never,
  );
}

describe('OperationsCambioDiscoService.cambiar', () => {
  it('cambia un solo eje (compatibilidad con el flujo anterior)', async () => {
    const entorno = crearEntorno();
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'nuevo-e1-izquierdo',
          discoNuevoDerechoId: 'nuevo-e1-derecho',
        },
      ],
      tecnicoNombre: 'Juan Pérez',
    };
    const resultado = await service.cambiar(dto, 'user-1');

    expect(resultado.discosRemovidos).toEqual([
      'viejo-e1-izquierdo',
      'viejo-e1-derecho',
    ]);
    expect(resultado.discosMontados).toEqual([
      'nuevo-e1-izquierdo',
      'nuevo-e1-derecho',
    ]);
    expect(entorno.archivosRef()).toHaveLength(1);
    expect(entorno.scanRecordsRef()).toHaveLength(2);
    expect(entorno.movimientosRef()).toHaveLength(4);
    const izq = entorno.discosRef().find((d) => d.id === 'viejo-e1-izquierdo')!;
    expect(izq.stage).toBe('almacen');
    expect(izq.fase).toBe('usada');
    expect(izq.wagonUnitId).toBeNull();
    const nuevo = entorno
      .discosRef()
      .find((d) => d.id === 'nuevo-e1-izquierdo')!;
    expect(nuevo.stage).toBe('en_servicio');
    expect(entorno.wearRate.recalcularParaDiscos).toHaveBeenCalledWith(
      resultado.discosMontados,
    );

    // Mediciones lee coche/n° coche/bogie/eje/rueda/lado de estos campos
    // denormalizados del propio ScanRecord (nunca de un join a BrakeDisc) —
    // deben quedar poblados o la fila aparece con Tren pero sin posición.
    const scanIzq = entorno
      .scanRecordsRef()
      .find((s) => s.discId === 'nuevo-e1-izquierdo')!;
    expect(scanIzq.cocheExcel).toBe('MA1');
    expect(scanIzq.numeroCocheExcel).toBe(201);
    expect(scanIzq.bogieExcel).toBe('PB3');
    expect(scanIzq.ejeExcel).toBe(1);
    expect(scanIzq.ubicacionExcel).toBe('izquierdo');
    expect(scanIzq.ruedaExcel).toBe(1);
    const scanDer = entorno
      .scanRecordsRef()
      .find((s) => s.discId === 'nuevo-e1-derecho')!;
    expect(scanDer.ubicacionExcel).toBe('derecho');
    expect(scanDer.ruedaExcel).toBe(2);
  });

  it('cambia hasta 4 ejes del mismo coche en una sola operación, compartiendo operacionId y UploadedFile', async () => {
    const entorno = crearEntorno();
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [1, 2, 3, 4].map((ejeNumero) => ({
        bogieCodigo: 'PB3',
        ejeNumero,
        discoNuevoIzquierdoId: `nuevo-e${ejeNumero}-izquierdo`,
        discoNuevoDerechoId: `nuevo-e${ejeNumero}-derecho`,
      })),
      tecnicoNombre: 'Juan Pérez',
    };
    const resultado = await service.cambiar(dto, 'user-1');

    expect(resultado.discosRemovidos).toHaveLength(8);
    expect(resultado.discosMontados).toHaveLength(8);
    // 1 solo UploadedFile compartido por los 4 ejes, no uno por eje.
    expect(entorno.archivosRef()).toHaveLength(1);
    expect(entorno.scanRecordsRef()).toHaveLength(8);
    expect(entorno.movimientosRef()).toHaveLength(16);
    expect(
      entorno
        .movimientosRef()
        .every((m) => m.operacionId === resultado.operacionId),
    ).toBe(true);
  });

  it('rechaza si el mismo eje aparece 2 veces en la lista de asignaciones', async () => {
    const entorno = crearEntorno();
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'nuevo-e1-izquierdo',
          discoNuevoDerechoId: 'nuevo-e1-derecho',
        },
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'nuevo-e2-izquierdo',
          discoNuevoDerechoId: 'nuevo-e2-derecho',
        },
      ],
      tecnicoNombre: 'Juan Pérez',
    };

    await expect(service.cambiar(dto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    // No debe haber tocado la base de datos.
    expect(entorno.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza si un disco de reemplazo se reutiliza en más de un eje', async () => {
    const entorno = crearEntorno();
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'nuevo-e1-izquierdo',
          discoNuevoDerechoId: 'nuevo-e1-derecho',
        },
        {
          bogieCodigo: 'PB3',
          ejeNumero: 2,
          discoNuevoIzquierdoId: 'nuevo-e1-izquierdo',
          discoNuevoDerechoId: 'nuevo-e2-derecho',
        },
      ],
      tecnicoNombre: 'Juan Pérez',
    };

    await expect(service.cambiar(dto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lanza ConflictException si no hay 2 discos montados en el eje pedido', async () => {
    // Sin discos en_servicio en el eje 1 — simula que ya fue cambiado antes.
    const entorno = crearEntorno({
      ocultarIds: ['viejo-e1-izquierdo', 'viejo-e1-derecho'],
    });
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'nuevo-e1-izquierdo',
          discoNuevoDerechoId: 'nuevo-e1-derecho',
        },
      ],
      tecnicoNombre: 'Juan Pérez',
    };

    await expect(service.cambiar(dto, 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('lanza BadRequestException si el disco de reemplazo no está en Taller', async () => {
    const entorno = crearEntorno();
    const service = crearServicio(entorno);

    const dto: CambioDiscoDto = {
      numeroCoche: 201,
      asignaciones: [
        // viejo-e2-izquierdo está en_servicio, no en taller.
        {
          bogieCodigo: 'PB3',
          ejeNumero: 1,
          discoNuevoIzquierdoId: 'viejo-e2-izquierdo',
          discoNuevoDerechoId: 'nuevo-e1-derecho',
        },
      ],
      tecnicoNombre: 'Juan Pérez',
    };

    await expect(service.cambiar(dto, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
