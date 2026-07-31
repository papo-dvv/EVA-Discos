import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import type { PrismaService } from '../prisma/prisma.service';
import {
  enriquecerAccionRecomendadaConfirmado,
  enriquecerAccionRecomendadaDraft,
  paginarFiltrandoPorAccion,
} from './accion-recomendada.query';
import type { PreviewRow } from './scan-record-query';

const evaluador = new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO);

// Mismo criterio que ORDEN_MAS_RECIENTE en accion-recomendada.query.ts. La
// función bajo prueba confía en que el resultado YA viene ordenado (así lo
// entrega Prisma con `orderBy`); el mock tiene que ordenar de verdad para
// simular eso, no basta con el orden en que se listan los fixtures.
function masRecientePrimero(
  a: { fecha?: Date; kilometraje?: number },
  b: { fecha?: Date; kilometraje?: number },
): number {
  const fa = a.fecha?.getTime() ?? 0;
  const fb = b.fecha?.getTime() ?? 0;
  if (fa !== fb) return fb - fa;
  return (b.kilometraje ?? 0) - (a.kilometraje ?? 0);
}

function mockFindManyOrdenado<T extends { fecha?: Date; kilometraje?: number }>(
  candidatos: T[],
) {
  // jest.fn(impl) en vez de jest.fn().mockResolvedValue(...): así TS infiere
  // el tipo del mock a partir de la firma de la implementación en vez de caer
  // en jest.Mock<any, any> (evita no-unsafe-assignment en cada call site).
  return jest.fn(() =>
    Promise.resolve([...candidatos].sort(masRecientePrimero)),
  );
}

function fila(overrides: Partial<PreviewRow> = {}): PreviewRow {
  return {
    id: 'row-1',
    discId: null,
    responsableNombre: 'Juan Pérez',
    trenNumero: 6,
    kilometraje: 100,
    fecha: '2026-01-01',
    motivo: 'Medición',
    cocheExcel: 'MA1',
    numeroCocheExcel: 129,
    bogieExcel: 'PB3',
    ejeExcel: 1,
    ruedaExcel: 1,
    ubicacionExcel: 'izquierdo',
    hValue: 1.0,
    tValue: 2.0,
    rdValue: 1.0,
    estadoCalculado: 'OK',
    estadoSugeridoExcel: null,
    corregidoPorHoja: false,
    trenOriginalExcel: null,
    discrepanciaEstadoExcel: false,
    hojaExcelOrigen: 'T06',
    accionRecomendada: null,
    ladoAfectado: null,
    ...overrides,
  };
}

describe('enriquecerAccionRecomendadaDraft', () => {
  it('cruza el disco con su par (mismo eje, lado opuesto) usando la medición más reciente de cada lado', async () => {
    // H=2.0, Rd=1.5 en ambos lados -> H>=1.6 y (Rd-0.8)=0.7>0.4 -> REPERFILADO
    // viable en cada lado por separado -> 'ambos'.
    const candidatos = [
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
        hValue: 2.0,
        rdValue: 1.5,
      },
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'derecho',
        ruedaExcel: 2,
        hValue: 2.0,
        rdValue: 1.5,
      },
    ];
    const findManyMock = mockFindManyOrdenado(candidatos);
    const prisma = {
      scanRecord: { findMany: findManyMock },
    } as unknown as PrismaService;

    const filas = [
      fila({ id: 'r1', ubicacionExcel: 'izquierdo', ruedaExcel: 1 }),
    ];
    const resultado = await enriquecerAccionRecomendadaDraft(
      prisma,
      'file-1',
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBe('REPERFILADO');
    expect(resultado[0].ladoAfectado).toBe('ambos');
    // Consulta acotada al fileId (nunca a toda la tabla).
    const args = findManyMock.mock.calls[0][0] as { where: { fileId: string } };
    expect(args.where.fileId).toBe('file-1');
  });

  it('usa la medición MÁS RECIENTE de cada lado, no necesariamente la de la fila que recibe el valor', async () => {
    // Lado izquierdo: 2 mediciones históricas, la más reciente (2026-02-01)
    // es la que debe usarse, no la más vieja (2026-01-01) aunque esta sea la
    // que efectivamente se está renderizando en `filas`.
    const candidatos = [
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
        fecha: new Date('2026-01-01'),
        kilometraje: 100,
        hValue: 0.5, // vieja: NO viable (H bajo) — no debería usarse
        rdValue: 3.0,
      },
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
        fecha: new Date('2026-03-01'),
        kilometraje: 300,
        hValue: 2.0, // más reciente: SÍ viable — esta es la que debe ganar
        rdValue: 1.5,
      },
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'derecho',
        ruedaExcel: 2,
        fecha: new Date('2026-03-01'),
        kilometraje: 300,
        hValue: 2.0,
        rdValue: 1.5,
      },
    ];
    const prisma = {
      scanRecord: { findMany: mockFindManyOrdenado(candidatos) },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r-vieja', fecha: '2026-01-01' })];
    const resultado = await enriquecerAccionRecomendadaDraft(
      prisma,
      'file-1',
      filas,
      evaluador,
    );

    // Si hubiera usado la medición vieja (H=0.5), no sería viable -> NINGUNA.
    // Usando la más reciente (H=2.0) en ambos lados -> REPERFILADO/ambos.
    expect(resultado[0].accionRecomendada).toBe('REPERFILADO');
    expect(resultado[0].ladoAfectado).toBe('ambos');
  });

  it('sin medición del lado opuesto en el archivo -> accionRecomendada null', async () => {
    const candidatos = [
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
        hValue: 2.0,
        rdValue: 1.5,
      },
    ];
    const prisma = {
      scanRecord: { findMany: mockFindManyOrdenado(candidatos) },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1' })];
    const resultado = await enriquecerAccionRecomendadaDraft(
      prisma,
      'file-1',
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBeNull();
    expect(resultado[0].ladoAfectado).toBeNull();
  });

  it('fila sin identidad completa (falta bogie) -> ni siquiera consulta, la deja sin acción', async () => {
    const findManyMock = jest.fn();
    const prisma = {
      scanRecord: { findMany: findManyMock },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1', bogieExcel: null })];
    const resultado = await enriquecerAccionRecomendadaDraft(
      prisma,
      'file-1',
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBeNull();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('crítico (Rd<=0) en un solo lado ya alcanza para CRITICO/ambos, sin importar el otro lado', async () => {
    const candidatos = [
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'izquierdo',
        ruedaExcel: 1,
        hValue: 2.0,
        rdValue: 0, // crítico
      },
      {
        numeroCocheExcel: 129,
        bogieExcel: 'PB3',
        ejeExcel: 1,
        ubicacionExcel: 'derecho',
        ruedaExcel: 2,
        hValue: 0.5,
        rdValue: 5.0, // lado sano
      },
    ];
    const prisma = {
      scanRecord: { findMany: mockFindManyOrdenado(candidatos) },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1' })];
    const resultado = await enriquecerAccionRecomendadaDraft(
      prisma,
      'file-1',
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBe('CRITICO');
    expect(resultado[0].ladoAfectado).toBe('ambos');
  });
});

describe('enriquecerAccionRecomendadaConfirmado', () => {
  it('cruza el disco con su par vía BrakeDisc (wagonUnitId+bogieCodigo+ejeNumero, lado opuesto)', async () => {
    const discos = [
      {
        id: 'disc-L',
        wagonUnitId: 'wu-1',
        bogieCodigo: 'PB3',
        ejeNumero: 1,
        lado: 'izquierdo',
      },
      {
        id: 'disc-R',
        wagonUnitId: 'wu-1',
        bogieCodigo: 'PB3',
        ejeNumero: 1,
        lado: 'derecho',
      },
    ];
    const medicionesPorDisco: Record<
      string,
      { hValue: number; rdValue: number }
    > = {
      'disc-L': { hValue: 2.0, rdValue: 1.5 },
      'disc-R': { hValue: 2.0, rdValue: 1.5 },
    };
    const prisma = {
      brakeDisc: {
        findMany: jest.fn(
          ({ where }: { where: { id?: { in: string[] }; OR?: unknown[] } }) => {
            if (where.id) {
              return Promise.resolve(
                discos.filter((d) => where.id!.in.includes(d.id)),
              );
            }
            // Segunda llamada: OR de {wagonUnitId,bogieCodigo,ejeNumero,lado} —
            // en este fixture de un solo eje, cualquier condición del OR
            // matchea como mucho al disco opuesto ya conocido.
            return Promise.resolve(discos.filter((d) => d.id === 'disc-R'));
          },
        ),
      },
      scanRecord: {
        findFirst: jest.fn(({ where }: { where: { discId: string } }) =>
          Promise.resolve(medicionesPorDisco[where.discId] ?? null),
        ),
      },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1', discId: 'disc-L' })];
    const resultado = await enriquecerAccionRecomendadaConfirmado(
      prisma,
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBe('REPERFILADO');
    expect(resultado[0].ladoAfectado).toBe('ambos');
  });

  it('sin discId (no debería pasar en confirmados, pero por defensa) -> accionRecomendada null, sin consultar nada', async () => {
    const findManyMock = jest.fn();
    const prisma = {
      brakeDisc: { findMany: findManyMock },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1', discId: null })];
    const resultado = await enriquecerAccionRecomendadaConfirmado(
      prisma,
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBeNull();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  // Caso real Tren 32 / coche 208 / bogie PB4 / eje 22, reportado como "bug
  // de pareo": el disco/query opuesto SIEMPRE fue correcto (confirmado con
  // logs de diagnóstico contra la BD real) — la fila que se ve en pantalla es
  // simplemente una medición vieja y sana; el cálculo usa SIEMPRE la más
  // reciente de cada lado, sin importar cuál fila la esté mostrando. Estos
  // dos tests documentan ambos lados de ese mismo mecanismo.
  it('ambos lados con Rd=7.00 H=0 (sanísimos, única medición) -> NINGUNA para ambos lados', async () => {
    const discos = [
      {
        id: 'disc-der-22',
        wagonUnitId: 'wu-208',
        bogieCodigo: 'PB4',
        ejeNumero: 22,
        lado: 'derecho',
      },
      {
        id: 'disc-izq-22',
        wagonUnitId: 'wu-208',
        bogieCodigo: 'PB4',
        ejeNumero: 22,
        lado: 'izquierdo',
      },
    ];
    const medicionesPorDisco: Record<
      string,
      { hValue: number; rdValue: number }
    > = {
      'disc-der-22': { hValue: 0, rdValue: 7 },
      'disc-izq-22': { hValue: 0, rdValue: 7 },
    };
    const prisma = {
      brakeDisc: {
        findMany: jest.fn(
          ({ where }: { where: { id?: { in: string[] }; OR?: unknown[] } }) => {
            if (where.id) {
              return Promise.resolve(
                discos.filter((d) => where.id!.in.includes(d.id)),
              );
            }
            return Promise.resolve(
              discos.filter((d) => d.id === 'disc-izq-22'),
            );
          },
        ),
      },
      scanRecord: {
        findFirst: jest.fn(({ where }: { where: { discId: string } }) =>
          Promise.resolve(medicionesPorDisco[where.discId] ?? null),
        ),
      },
    } as unknown as PrismaService;

    const filas = [fila({ id: 'r1', discId: 'disc-der-22' })];
    const resultado = await enriquecerAccionRecomendadaConfirmado(
      prisma,
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBe('NINGUNA');
    expect(resultado[0].ladoAfectado).toBeNull();
  });

  it('la fila mostrada es una lectura vieja y sana, pero la medición MÁS RECIENTE del lado opuesto ya es crítica -> CRITICO/ambos (no NINGUNA)', async () => {
    // Refleja el caso real: la fila en pantalla (Rd=7.00, H=0) es de
    // 2024-01-10; desde entonces el lado izquierdo se deterioró y su
    // medición más reciente (no la mostrada en esta fila) tiene Rd<=0.
    const discos = [
      {
        id: 'disc-der-22',
        wagonUnitId: 'wu-208',
        bogieCodigo: 'PB4',
        ejeNumero: 22,
        lado: 'derecho',
      },
      {
        id: 'disc-izq-22',
        wagonUnitId: 'wu-208',
        bogieCodigo: 'PB4',
        ejeNumero: 22,
        lado: 'izquierdo',
      },
    ];
    const medicionesPorDisco: Record<
      string,
      { hValue: number; rdValue: number }
    > = {
      'disc-der-22': { hValue: 1.26, rdValue: 0.99 }, // más reciente, sano
      'disc-izq-22': { hValue: 1.5, rdValue: -0.05 }, // más reciente, crítico
    };
    const prisma = {
      brakeDisc: {
        findMany: jest.fn(
          ({ where }: { where: { id?: { in: string[] }; OR?: unknown[] } }) => {
            if (where.id) {
              return Promise.resolve(
                discos.filter((d) => where.id!.in.includes(d.id)),
              );
            }
            return Promise.resolve(
              discos.filter((d) => d.id === 'disc-izq-22'),
            );
          },
        ),
      },
      scanRecord: {
        findFirst: jest.fn(({ where }: { where: { discId: string } }) =>
          Promise.resolve(medicionesPorDisco[where.discId] ?? null),
        ),
      },
    } as unknown as PrismaService;

    // La fila que se está renderizando trae valores viejos y sanos (H=0,
    // Rd=7) — la función los ignora por completo: solo usa `discId` para
    // cruzar contra la medición más reciente real.
    const filas = [
      fila({
        id: 'r-vieja-sana',
        discId: 'disc-der-22',
        hValue: 0,
        rdValue: 7,
      }),
    ];
    const resultado = await enriquecerAccionRecomendadaConfirmado(
      prisma,
      filas,
      evaluador,
    );

    expect(resultado[0].accionRecomendada).toBe('CRITICO');
    expect(resultado[0].ladoAfectado).toBe('ambos');
  });
});

describe('paginarFiltrandoPorAccion', () => {
  function filaConAccion(id: string, accion: PreviewRow['accionRecomendada']) {
    return { id, accionRecomendada: accion };
  }
  const obtenerAccion = (f: ReturnType<typeof filaConAccion>) =>
    f.accionRecomendada;

  it('descarta null y NINGUNA cuando no están en la lista permitida', () => {
    const filas = [
      filaConAccion('a', 'CRITICO'),
      filaConAccion('b', null),
      filaConAccion('c', 'NINGUNA'),
      filaConAccion('d', 'CRITICO'),
    ];

    const resultado = paginarFiltrandoPorAccion(
      filas,
      obtenerAccion,
      ['CRITICO'],
      1,
      25,
    );

    expect(resultado.rows.map((f) => f.id)).toEqual(['a', 'd']);
    expect(resultado.total).toBe(2);
    expect(resultado.totalPages).toBe(1);
  });

  it('acepta varias acciones a la vez (OR entre ellas)', () => {
    const filas = [
      filaConAccion('a', 'CRITICO'),
      filaConAccion('b', 'CAMBIO'),
      filaConAccion('c', 'REPERFILADO'),
    ];

    const resultado = paginarFiltrandoPorAccion(
      filas,
      obtenerAccion,
      ['CRITICO', 'REPERFILADO'],
      1,
      25,
    );

    expect(resultado.rows.map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('pagina el conjunto YA filtrado, no el original', () => {
    const filas = Array.from({ length: 7 }, (_, i) =>
      filaConAccion(`f${i}`, i % 2 === 0 ? 'CRITICO' : 'NINGUNA'),
    );
    // 4 filas con CRITICO (f0,f2,f4,f6) de las 7 totales.

    const pagina1 = paginarFiltrandoPorAccion(
      filas,
      obtenerAccion,
      ['CRITICO'],
      1,
      3,
    );
    const pagina2 = paginarFiltrandoPorAccion(
      filas,
      obtenerAccion,
      ['CRITICO'],
      2,
      3,
    );

    expect(pagina1.total).toBe(4);
    expect(pagina1.totalPages).toBe(2); // ceil(4/3), NO ceil(7/3)
    expect(pagina1.rows.map((f) => f.id)).toEqual(['f0', 'f2', 'f4']);
    expect(pagina2.rows.map((f) => f.id)).toEqual(['f6']);
  });

  it('sin ninguna fila que matchee -> total 0, totalPages 1 (nunca 0)', () => {
    const filas = [filaConAccion('a', 'NINGUNA')];

    const resultado = paginarFiltrandoPorAccion(
      filas,
      obtenerAccion,
      ['CRITICO'],
      1,
      25,
    );

    expect(resultado.rows).toEqual([]);
    expect(resultado.total).toBe(0);
    expect(resultado.totalPages).toBe(1);
  });
});
