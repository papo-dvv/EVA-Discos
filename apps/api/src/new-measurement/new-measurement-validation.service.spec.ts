import { UnprocessableEntityException } from '@nestjs/common';
import { NewMeasurementValidationService } from './new-measurement-validation.service';

interface FakeFicha {
  id: string;
  uploadedFileId: string | null;
  trenNumero: number;
  kilometraje: number;
  fechaFicha: Date;
  verificado: boolean;
  ptCodigo: string | null;
}

interface FakeScanRecord {
  id: string;
  fileId: string;
  discId: string | null;
  trenNumero: number;
  kilometraje: number;
  fecha: Date;
  cocheExcel: string | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  tValue: number;
  rdValue: number;
  kmInvalido: boolean;
  fechaInvalido: boolean;
  tInvalido: boolean;
  rdInvalido: boolean;
  // Mismo campo que ScanRecord.ordenFisico (ver common/orden-fisico.ts) — el
  // fake de scanRecord.findMany lo usa para simular el orderBy real de
  // ORDEN_FISICO_DEFECTO, ver compararPorOrderBy más abajo.
  ordenFisico: number;
}

// Simula el orderBy real de Prisma (array de { campo: 'asc'|'desc' }) sobre
// el fake en memoria — necesario para probar que recalcularFlags/verificar
// piden ORDEN_FISICO_DEFECTO de verdad, no solo que "funcionan" con el orden
// de inserción del array de fixtures (que por sí solo no probaría nada).
function compararPorOrderBy(
  orderBy: Record<string, 'asc' | 'desc'>[],
  a: FakeScanRecord,
  b: FakeScanRecord,
): number {
  for (const criterio of orderBy) {
    const [campo, dir] = Object.entries(criterio)[0] as [
      keyof FakeScanRecord,
      'asc' | 'desc',
    ];
    const va = a[campo];
    const vb = b[campo];
    const cmp =
      va instanceof Date && vb instanceof Date
        ? va.getTime() - vb.getTime()
        : typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb));
    if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  }
  return 0;
}

// Fake de PrismaService con estado en memoria real (mismo patrón que
// new-measurement-commit.service.spec.ts): el tren 32 tiene un único coche
// MA1 sembrado (wagon-ma1); brakeDisc.findUnique sintetiza un disco por cada
// combinación eje/lado bajo ese coche — alcanza para ejercitar la resolución
// de identidad de resolverDiscIdSilencioso sin levantar una base de datos.
function crearEntorno(opts: {
  ficha?: Partial<FakeFicha>;
  scanRecords?: FakeScanRecord[];
}) {
  const ficha: FakeFicha = {
    id: 'ficha-1',
    uploadedFileId: 'file-1',
    trenNumero: 32,
    kilometraje: 120000,
    fechaFicha: new Date('2026-03-01'),
    verificado: false,
    // Con valor por defecto (obligatorio recién en bloquear()): los tests que
    // no ejercitan esa regla en particular no necesitan setearlo.
    ptCodigo: 'PT-001',
    ...opts.ficha,
  };
  let scanRecords: FakeScanRecord[] = opts.scanRecords ?? [];
  const tren = { id: 'tren-32', numero: 32 };
  const wagon = { id: 'wagon-ma1', trenId: 'tren-32', tipoCoche: 'MA1' };

  const prisma = {
    measurementSheet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === ficha.id ? { ...ficha } : null),
      ),
      update: jest.fn(({ data }: { data: Partial<FakeFicha> }) => {
        Object.assign(ficha, data);
        return Promise.resolve({ ...ficha });
      }),
    },
    scanRecord: {
      findMany: jest.fn(
        ({
          where,
          orderBy,
        }: {
          where: { fileId: string };
          orderBy?: Record<string, 'asc' | 'desc'>[];
        }) => {
          const filtradas = scanRecords.filter(
            (r) => r.fileId === where.fileId,
          );
          const resultado = orderBy
            ? [...filtradas].sort((a, b) => compararPorOrderBy(orderBy, a, b))
            : filtradas;
          return Promise.resolve(resultado);
        },
      ),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: {
            trenNumero?: number;
            discId?: string | { not: null };
            fileId?: string;
          };
        }) => {
          // where.fileId (ver obtenerFlagsRaiz): consulta plana por ficha,
          // sin el requisito de "confirmada" (discId no nulo) que sí aplica
          // a las búsquedas de referencia histórica de abajo.
          if (where.fileId !== undefined) {
            const candidatos = scanRecords.filter(
              (r) => r.fileId === where.fileId,
            );
            return Promise.resolve(candidatos[0] ?? null);
          }

          let candidatos = scanRecords.filter((r) => r.discId !== null);
          if (where.trenNumero !== undefined) {
            candidatos = candidatos.filter(
              (r) => r.trenNumero === where.trenNumero,
            );
          }
          if (typeof where.discId === 'string') {
            candidatos = candidatos.filter((r) => r.discId === where.discId);
          }
          candidatos = [...candidatos].sort((a, b) => {
            if (a.fecha.getTime() !== b.fecha.getTime()) {
              return b.fecha.getTime() - a.fecha.getTime();
            }
            if (a.kilometraje !== b.kilometraje) {
              return b.kilometraje - a.kilometraje;
            }
            return b.id.localeCompare(a.id);
          });
          return Promise.resolve(candidatos[0] ?? null);
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeScanRecord>;
        }) => {
          scanRecords = scanRecords.map((r) =>
            r.id === where.id ? { ...r, ...data } : r,
          );
          return Promise.resolve(scanRecords.find((r) => r.id === where.id));
        },
      ),
    },
    train: {
      findUnique: jest.fn(({ where }: { where: { numero: number } }) =>
        Promise.resolve(where.numero === tren.numero ? tren : null),
      ),
    },
    wagonUnit: {
      findFirst: jest.fn(
        ({ where }: { where: { trenId: string; tipoCoche: string } }) =>
          Promise.resolve(
            where.trenId === wagon.trenId && where.tipoCoche === wagon.tipoCoche
              ? wagon
              : null,
          ),
      ),
    },
    // Sintetiza un disco físico determinístico por cada combinación eje/lado
    // bajo el único coche sembrado (wagon-ma1) — evita hardcodear un solo
    // disco cuando un test necesita más de uno (ej. dos filas de la misma
    // ficha, cada una comparándose contra el historial de SU PROPIO disco).
    brakeDisc: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            wagonUnitId_bogieCodigo_ejeNumero_lado: {
              wagonUnitId: string;
              bogieCodigo: string;
              ejeNumero: number;
              lado: string;
            };
          };
        }) => {
          const c = where.wagonUnitId_bogieCodigo_ejeNumero_lado;
          if (c.wagonUnitId !== wagon.id) return Promise.resolve(null);
          return Promise.resolve({
            id: `disco-eje${c.ejeNumero}-${c.lado}`,
            wagonUnitId: c.wagonUnitId,
            bogieCodigo: c.bogieCodigo,
            ejeNumero: c.ejeNumero,
            lado: c.lado,
          });
        },
      ),
    },
  };

  return {
    // $transaction acá recibe un ARRAY de promesas ya disparadas (ver
    // recalcularFlags/verificar), no un callback — a diferencia del patrón
    // usado en new-measurement-commit.service.spec.ts.
    prisma: {
      ...prisma,
      $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
    },
    fichaRef: () => ficha,
    scanRecordsRef: () => scanRecords,
  };
}

function filaBase(overrides: Partial<FakeScanRecord>): FakeScanRecord {
  return {
    id: 'fila-1',
    fileId: 'file-1',
    discId: null,
    trenNumero: 32,
    kilometraje: 120000,
    fecha: new Date('2026-03-01'),
    cocheExcel: 'MA1',
    bogieExcel: 'PB3',
    ejeExcel: 1,
    ubicacionExcel: 'izquierdo',
    tValue: 5,
    rdValue: 3,
    kmInvalido: false,
    fechaInvalido: false,
    tInvalido: false,
    rdInvalido: false,
    ordenFisico: 0,
    ...overrides,
  };
}

describe('NewMeasurementValidationService.recalcularFlags', () => {
  it('fila con T mayor al último confirmado del MISMO disco se marca t_invalido', async () => {
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior', // ya confirmada, en OTRA carga
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const filaEnCurso = filaBase({ id: 'fila-1', tValue: 10, rdValue: 3 });
    const { prisma, scanRecordsRef } = crearEntorno({
      scanRecords: [referenciaDisco, filaEnCurso],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resultado = await service.recalcularFlags('ficha-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].tInvalido).toBe(true);
    expect(scanRecordsRef().find((r) => r.id === 'fila-1')?.tInvalido).toBe(
      true,
    );
  });

  it('T menor o igual al último confirmado del disco NO se marca t_invalido', async () => {
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const filaEnCurso = filaBase({ id: 'fila-1', tValue: 8, rdValue: 3 });
    const { prisma } = crearEntorno({
      scanRecords: [referenciaDisco, filaEnCurso],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const [resultado] = await service.recalcularFlags('ficha-1');

    expect(resultado.tInvalido).toBe(false);
  });

  it('ficha con kilometraje menor al último confirmado del TREN se marca km_invalido en TODAS las filas', async () => {
    const referenciaTren = filaBase({
      id: 'referencia-tren',
      fileId: 'file-anterior',
      discId: 'disco-otro', // otro disco del mismo tren — el nivel es TREN, no disco
      fecha: new Date('2026-01-01'),
      kilometraje: 150000,
    });
    const fila1 = filaBase({ id: 'fila-1', ejeExcel: 1 });
    const fila2 = filaBase({
      id: 'fila-2',
      ejeExcel: 2,
      bogieExcel: 'PB3',
    });
    const { prisma, scanRecordsRef } = crearEntorno({
      ficha: { kilometraje: 120000 }, // < 150000
      scanRecords: [referenciaTren, fila1, fila2],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await service.recalcularFlags('ficha-1');

    const filas = scanRecordsRef().filter((r) => r.id !== 'referencia-tren');
    expect(filas).toHaveLength(2);
    for (const f of filas) {
      expect(f.kmInvalido).toBe(true);
    }
  });

  it('sin medición previa confirmada del disco/tren, ninguna fila se marca inválida', async () => {
    const fila1 = filaBase({ id: 'fila-1' });
    const { prisma, scanRecordsRef } = crearEntorno({
      scanRecords: [fila1],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await service.recalcularFlags('ficha-1');

    const f = scanRecordsRef()[0];
    expect(f.kmInvalido).toBe(false);
    expect(f.fechaInvalido).toBe(false);
    expect(f.tInvalido).toBe(false);
    expect(f.rdInvalido).toBe(false);
  });
});

describe('NewMeasurementValidationService.verificar', () => {
  it('filasExcluidas lista SOLO las filas que siguen inválidas (problema propio t/rd) tras la re-evaluación', async () => {
    const referenciaDiscoEje1 = filaBase({
      id: 'referencia-disco-eje1',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const referenciaDiscoEje2 = filaBase({
      id: 'referencia-disco-eje2',
      fileId: 'file-anterior',
      discId: 'disco-eje2-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    // fila-1 quedó marcada t_invalido por una validación vieja (stale), pero
    // el usuario YA corrigió el valor de T — verificar() recalcula desde cero
    // y debe encontrarla válida ahora.
    const filaCorregida = filaBase({
      id: 'fila-1',
      tValue: 8,
      rdValue: 3,
      tInvalido: true,
    });
    // fila-2 sigue con T mayor al último confirmado de SU disco — sigue inválida.
    const filaInvalida = filaBase({
      id: 'fila-2',
      ejeExcel: 2,
      tValue: 12,
      rdValue: 3,
    });
    const { prisma, fichaRef, scanRecordsRef } = crearEntorno({
      scanRecords: [
        referenciaDiscoEje1,
        referenciaDiscoEje2,
        filaCorregida,
        filaInvalida,
      ],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.todoValido).toBe(false);
    expect(resumen.filasIncluidas).toBe(1);
    expect(resumen.filasExcluidas).toHaveLength(1);
    expect(resumen.filasExcluidas[0].recordId).toBe('fila-2');
    expect(resumen.filasExcluidas[0].eje).toBe(2);
    expect(resumen.filasExcluidas[0].lado).toBe('izquierdo');
    // Motivo legible por campo, no solo el string plano de antes.
    expect(resumen.filasExcluidas[0].motivos).toEqual([
      {
        campo: 't',
        motivo:
          'Espesor medido (T) mayor al último valor registrado para este disco',
      },
    ]);
    // Sin discrepancia de km/fecha en este fixture (ninguna fila la trae).
    expect(resumen.kmInvalido).toBeNull();
    expect(resumen.fechaInvalido).toBeNull();

    // Persistidos: tInvalido de fila-1 se corrigió a false, fila-2 sigue true.
    const filas = scanRecordsRef().filter((r) => r.id.startsWith('fila-'));
    expect(filas.find((f) => f.id === 'fila-1')?.tInvalido).toBe(false);
    expect(filas.find((f) => f.id === 'fila-2')?.tInvalido).toBe(true);
    // Modelo binario: con al menos 1 fila inválida, verificado NUNCA queda en
    // true (ver punto 3 del enunciado — antes se ponía true incondicional).
    expect(fichaRef().verificado).toBe(false);
  });

  it('todoValido=true y verificado=true cuando ninguna fila queda inválida', async () => {
    const filaValida = filaBase({ id: 'fila-1' });
    const { prisma, fichaRef } = crearEntorno({
      scanRecords: [filaValida],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.todoValido).toBe(true);
    expect(resumen.filasExcluidas).toHaveLength(0);
    expect(resumen.filasIncluidas).toBe(1);
    expect(fichaRef().verificado).toBe(true);
  });

  it('kmInvalido/fechaInvalido a nivel ficha viajan con motivo legible ÚNICAMENTE en la raíz de la response, nunca replicados por fila', async () => {
    const referenciaTren = filaBase({
      id: 'referencia-tren',
      fileId: 'file-anterior',
      discId: 'disco-otro',
      fecha: new Date('2026-03-15'),
      kilometraje: 150000,
    });
    // fila1 no tiene NINGÚN problema propio (t/rd) — su única discrepancia es
    // la de la ficha (km/fecha), que es a nivel FICHA, no de esta fila.
    const fila1 = filaBase({ id: 'fila-1' });
    const { prisma, fichaRef } = crearEntorno({
      // kilometraje < referencia Y fecha < referencia -> ambos flags activos.
      ficha: { kilometraje: 120000, fechaFicha: new Date('2026-03-01') },
      scanRecords: [referenciaTren, fila1],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.kmInvalido).toEqual({
      motivo: 'Kilometraje menor al último registrado para este tren',
    });
    expect(resumen.fechaInvalido).toEqual({
      motivo: 'Fecha anterior a la última medición registrada para este tren',
    });
    // Bug corregido (punto 2 del enunciado): fila-1 NO aparece en
    // filasExcluidas — kilometraje/fecha nunca se repiten por fila, solo
    // viajan una vez, a nivel raíz (arriba).
    expect(resumen.filasExcluidas).toHaveLength(0);
    // Pero todoValido SIGUE en false: un problema de ficha (km/fecha) basta
    // para bloquear, aunque ninguna fila individual quede "excluida".
    expect(resumen.todoValido).toBe(false);
    expect(fichaRef().verificado).toBe(false);
  });

  it('filasExcluidas viene ordenado por el mismo criterio jerárquico del sistema (ordenFisico ASC), sin importar el orden en que llegan de la base', async () => {
    // Mismo disco físico (eje1/izquierdo, default de filaBase) para las 3 —
    // alcanza una sola referencia con T menor para que las 3 salgan
    // t_invalido, sin tener que armar una identidad distinta por fila.
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      tValue: 5,
      rdValue: 6,
    });
    // Insertadas en orden DESCENDENTE de ordenFisico a propósito.
    const filaAlta = filaBase({
      id: 'fila-alta',
      ordenFisico: 3000,
      tValue: 10,
    });
    const filaBaja = filaBase({
      id: 'fila-baja',
      ordenFisico: 100,
      tValue: 10,
    });
    const filaMedia = filaBase({
      id: 'fila-media',
      ordenFisico: 1500,
      tValue: 10,
    });
    const { prisma } = crearEntorno({
      scanRecords: [referenciaDisco, filaAlta, filaBaja, filaMedia],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.filasExcluidas.map((f) => f.recordId)).toEqual([
      'fila-baja',
      'fila-media',
      'fila-alta',
    ]);
  });
});

describe('NewMeasurementValidationService.verificar — T/Rd/Km/Fecha', () => {
  it('evalúa T/Rd/Km/Fecha con normalidad contra el historial confirmado', async () => {
    const referenciaDisco = filaBase({
      id: 'referencia-disco',
      fileId: 'file-anterior',
      discId: 'disco-eje1-izquierdo',
      fecha: new Date('2026-01-01'),
      kilometraje: 100000,
      tValue: 8,
      rdValue: 6,
    });
    const filaInvalida = filaBase({ id: 'fila-1', tValue: 12, rdValue: 3 });
    const { prisma, fichaRef } = crearEntorno({
      scanRecords: [referenciaDisco, filaInvalida],
    });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.verificar('ficha-1');

    expect(resumen.todoValido).toBe(false);
    expect(resumen.filasExcluidas).toHaveLength(1);
    expect(resumen.filasExcluidas[0].recordId).toBe('fila-1');
    expect(fichaRef().verificado).toBe(false);
  });
});

describe('NewMeasurementValidationService.bloquear', () => {
  it('rechaza con 422 si la ficha no fue verificada (verificado=false)', async () => {
    const { prisma } = crearEntorno({ ficha: { verificado: false } });
    const service = new NewMeasurementValidationService(prisma as never);

    await expect(service.bloquear('ficha-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('bloquea la tabla cuando la ficha está verificada', async () => {
    const { prisma } = crearEntorno({ ficha: { verificado: true } });
    const service = new NewMeasurementValidationService(prisma as never);

    const resumen = await service.bloquear('ficha-1');

    expect(resumen).toEqual({ fichaId: 'ficha-1', tablaBloqueada: true });
  });

  it('rechaza con 422 si falta el P.T. (pt_codigo null) aunque la ficha esté verificada', async () => {
    const { prisma } = crearEntorno({
      ficha: { verificado: true, ptCodigo: null },
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await expect(service.bloquear('ficha-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.bloquear('ficha-1')).rejects.toThrow(/P\.T\./);
  });

  it('rechaza con 422 si el P.T. es solo espacios aunque la ficha esté verificada', async () => {
    const { prisma } = crearEntorno({
      ficha: { verificado: true, ptCodigo: '   ' },
    });
    const service = new NewMeasurementValidationService(prisma as never);

    await expect(service.bloquear('ficha-1')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('NewMeasurementValidationService.obtenerFlagsRaiz', () => {
  it('lee los flags YA PERSISTIDOS de la ficha (sin recalcular)', async () => {
    const fila1 = filaBase({
      id: 'fila-1',
      kmInvalido: true,
      fechaInvalido: false,
    });
    const { prisma } = crearEntorno({ scanRecords: [fila1] });
    const service = new NewMeasurementValidationService(prisma as never);

    const flags = await service.obtenerFlagsRaiz('ficha-1');

    expect(flags.kmInvalido).toEqual({
      motivo: 'Kilometraje menor al último registrado para este tren',
    });
    expect(flags.fechaInvalido).toBeNull();
  });

  it('sin filas todavía, ambos flags quedan null', async () => {
    const { prisma } = crearEntorno({ scanRecords: [] });
    const service = new NewMeasurementValidationService(prisma as never);

    const flags = await service.obtenerFlagsRaiz('ficha-1');

    expect(flags).toEqual({ kmInvalido: null, fechaInvalido: null });
  });
});
