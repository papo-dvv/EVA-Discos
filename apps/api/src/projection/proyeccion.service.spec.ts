import type { PrismaService } from '../prisma/prisma.service';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import type { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import type {
  PosicionDisco,
  ProyeccionCalculatorService,
  ProyeccionDisco,
} from './proyeccion-calculator.service';
import type { ProyeccionRateService } from './proyeccion-rate.service';
import { ProyeccionService } from './proyeccion.service';

const TIPOS_COCHE = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const;

function posicion(overrides: Partial<PosicionDisco> = {}): PosicionDisco {
  return {
    tipoCoche: 'MA1',
    numeroCoche: 101,
    bogieCodigo: 'PB3',
    ejeNumero: 1,
    lado: 'izquierdo',
    ...overrides,
  };
}

function discoBrakeFixture(overrides: {
  id: string;
  trenNumero: number;
  tipoCoche?: string;
  bogieCodigo?: string;
  ejeNumero?: number;
  ruedaNumero?: number | null;
  lado?: 'izquierdo' | 'derecho';
  numeroCoche?: number;
}) {
  return {
    id: overrides.id,
    bogieCodigo: overrides.bogieCodigo ?? 'PB3',
    ejeNumero: overrides.ejeNumero ?? 1,
    ruedaNumero: overrides.ruedaNumero ?? 1,
    lado: overrides.lado ?? 'izquierdo',
    activo: true,
    wagonUnit: {
      tipoCoche: overrides.tipoCoche ?? 'MA1',
      numeroCoche: overrides.numeroCoche ?? 101,
      tren: { numero: overrides.trenNumero },
    },
  };
}

function proyeccionFixture(
  overrides: Partial<ProyeccionDisco> = {},
): ProyeccionDisco {
  return {
    discId: 'disco-1',
    posicion: posicion(),
    fechaUltimaMedicion: new Date('2026-01-01T00:00:00.000Z'),
    h: 0.2,
    t: 5.2,
    rd: 5.0,
    estado: 'OK',
    tasaMensual: 0.25,
    proyectable: true,
    motivo: null,
    motivoUltimaMedicion: 'Medición',
    responsableUltimaMedicion: 'Responsable Test',
    ciclosReperfilado: [],
    cicloCambio: null,
    ...overrides,
  };
}

function crearBrakeDiscRules() {
  return {
    obtenerUmbrales: jest.fn().mockResolvedValue(UMBRALES_POR_DEFECTO),
  } as unknown as BrakeDiscRulesService;
}

function crearRate(tasas: Partial<Record<string, number | null>> = {}) {
  const completo = Object.fromEntries(
    TIPOS_COCHE.map((t) => [t, tasas[t] ?? null]),
  );
  return {
    calcularTasasPorTipoCoche: jest.fn().mockResolvedValue(completo),
  } as unknown as ProyeccionRateService;
}

describe('ProyeccionService.listarDiscos', () => {
  it('ordena tren -> orden físico, pagina y arma el response shape', async () => {
    const discos = [
      discoBrakeFixture({ id: 'b', trenNumero: 1, tipoCoche: 'MB1' }),
      discoBrakeFixture({ id: 'a', trenNumero: 1, tipoCoche: 'MA1' }),
      discoBrakeFixture({ id: 'c', trenNumero: 2, tipoCoche: 'MA1' }),
    ];
    const findManyMock = jest.fn().mockResolvedValue(discos);
    const prisma = {
      brakeDisc: { findMany: findManyMock },
    } as unknown as PrismaService;

    const proyectarDisco = jest.fn((discId: string) =>
      Promise.resolve(proyeccionFixture({ discId })),
    );
    const calculator = {
      proyectarDisco,
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const resultado = await service.listarDiscos({ page: 1, pageSize: 2 });

    expect(resultado.total).toBe(3);
    expect(resultado.totalPages).toBe(2);
    expect(resultado.rows).toHaveLength(2);
    // MA1 (a) va antes que MB1 (b) dentro del mismo tren -- orden físico real
    // (ORDEN_COCHE), no alfabético.
    expect(resultado.rows.map((r) => r.discId)).toEqual(['a', 'b']);
    expect(resultado.rows[0].trenNumero).toBe(1);
    expect(resultado.rows[0].fechaUltimaMedicion).toBe('2026-01-01');
  });

  it('pasa el filtro de tren como relación anidada wagonUnit.tren.numero', async () => {
    const findManyMock = jest.fn((args: { where: unknown }) => {
      void args;
      return Promise.resolve([]);
    });
    const prisma = {
      brakeDisc: { findMany: findManyMock },
    } as unknown as PrismaService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      { proyectarDisco: jest.fn() } as unknown as ProyeccionCalculatorService,
      crearBrakeDiscRules(),
    );

    await service.listarDiscos({ tren: 7, page: 1, pageSize: 25 });

    expect(findManyMock.mock.calls[0][0].where).toEqual({
      activo: true,
      stage: 'en_servicio',
      wagonUnit: { tren: { modelo: 'alstom_metropolis9000', numero: 7 } },
    });
  });

  it('omite discos sin ninguna medición confirmada (proyectarDisco -> null) sin reventar', async () => {
    const discos = [
      discoBrakeFixture({ id: 'sin-medicion', trenNumero: 1 }),
      discoBrakeFixture({
        id: 'con-medicion',
        trenNumero: 1,
        bogieCodigo: 'PB4',
      }),
    ];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        // Sin hermano en el fixture -> null (Parte 3, ver
        // resolverHermanoAdHoc): los tests de este archivo que no arman un
        // par izquierdo/derecho explícito no deben antepone nada.
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(
          discId === 'sin-medicion' ? null : proyeccionFixture({ discId }),
        ),
      ),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['con-medicion']);
  });

  it('un disco proyectable=false expone motivo y no rompe el resto del listado', async () => {
    const discos = [
      discoBrakeFixture({ id: 'sin-tasa', trenNumero: 1, tipoCoche: 'REM' }),
      discoBrakeFixture({
        id: 'con-tasa',
        trenNumero: 1,
        tipoCoche: 'MA1',
        bogieCodigo: 'PB4',
      }),
    ];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        // Sin hermano en el fixture -> null (Parte 3, ver
        // resolverHermanoAdHoc): los tests de este archivo que no arman un
        // par izquierdo/derecho explícito no deben antepone nada.
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(
          discId === 'sin-tasa'
            ? proyeccionFixture({
                discId,
                proyectable: false,
                motivo:
                  'Sin datos suficientes de tasa de desgaste para el tipo de coche REM en el rango de km configurado.',
                tasaMensual: null,
              })
            : proyeccionFixture({ discId }),
        ),
      ),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });

    expect(resultado.rows).toHaveLength(2);
    const filaSinTasa = resultado.rows.find((r) => r.discId === 'sin-tasa')!;
    expect(filaSinTasa.proyectable).toBe(false);
    expect(filaSinTasa.motivo).toContain('REM');
    const filaConTasa = resultado.rows.find((r) => r.discId === 'con-tasa')!;
    expect(filaConTasa.proyectable).toBe(true);
  });
});

describe('ProyeccionService.listarDiscos — filtros derivados', () => {
  function crearServicioConDiscos(
    proyeccionesPorId: Record<string, ProyeccionDisco>,
  ) {
    const discos = Object.keys(proyeccionesPorId).map((id) =>
      discoBrakeFixture({ id, trenNumero: 1 }),
    );
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        // Sin hermano en el fixture -> null (Parte 3, ver
        // resolverHermanoAdHoc): los tests de este archivo que no arman un
        // par izquierdo/derecho explícito no deben antepone nada.
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(proyeccionesPorId[discId]),
      ),
    } as unknown as ProyeccionCalculatorService;
    return new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
  }

  it('filtra por estado (incluye REPERFILADO)', async () => {
    const service = crearServicioConDiscos({
      ok: proyeccionFixture({ discId: 'ok', estado: 'OK' }),
      reperfilado: proyeccionFixture({
        discId: 'reperfilado',
        estado: 'REPERFILADO',
      }),
      critico: proyeccionFixture({ discId: 'critico', estado: 'CRITICO' }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      estado: ['REPERFILADO'],
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['reperfilado']);
    expect(resultado.total).toBe(1);
  });

  it('filtra por rango de fecha de Siguiente Reperfilado — un disco sin ciclos no matchea', async () => {
    const service = crearServicioConDiscos({
      'con-ciclo-en-rango': proyeccionFixture({
        discId: 'con-ciclo-en-rango',
        ciclosReperfilado: [
          {
            numero: 1,
            mesesHastaFecha: 2,
            fechaEstimada: new Date('2026-03-15T00:00:00.000Z'),
            hEnEseMomento: 1.6,
            tEnEseMomento: 3.6,
            rdAntes: 2.0,
            rdDespues: 1.2,
          },
        ],
      }),
      'con-ciclo-fuera-de-rango': proyeccionFixture({
        discId: 'con-ciclo-fuera-de-rango',
        ciclosReperfilado: [
          {
            numero: 1,
            mesesHastaFecha: 12,
            fechaEstimada: new Date('2027-01-01T00:00:00.000Z'),
            hEnEseMomento: 1.6,
            tEnEseMomento: 3.6,
            rdAntes: 2.0,
            rdDespues: 1.2,
          },
        ],
      }),
      'sin-ciclos': proyeccionFixture({
        discId: 'sin-ciclos',
        ciclosReperfilado: [],
        cicloCambio: {
          mesesHastaFecha: 1,
          fechaEstimada: new Date('2026-03-10T00:00:00.000Z'),
        },
      }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      siguienteReperfiladoDesde: '2026-03-01',
      siguienteReperfiladoHasta: '2026-03-31',
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['con-ciclo-en-rango']);
  });

  it('filtra por rango numérico de H/T/Rd', async () => {
    const service = crearServicioConDiscos({
      bajo: proyeccionFixture({ discId: 'bajo', h: 0.1 }),
      medio: proyeccionFixture({ discId: 'medio', h: 1.0 }),
      alto: proyeccionFixture({ discId: 'alto', h: 2.0 }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      hMin: 0.5,
      hMax: 1.5,
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['medio']);
  });

  it('modoCombinacion=OR: matchea con CUALQUIER filtro activo, no todos', async () => {
    const service = crearServicioConDiscos({
      // Matchea solo por estado.
      a: proyeccionFixture({ discId: 'a', estado: 'CRITICO', h: 0.1 }),
      // Matchea solo por H.
      b: proyeccionFixture({ discId: 'b', estado: 'OK', h: 5.0 }),
      // No matchea ninguno.
      c: proyeccionFixture({ discId: 'c', estado: 'OK', h: 0.1 }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      modoCombinacion: 'OR',
      estado: ['CRITICO'],
      hMin: 4,
    });

    expect(resultado.rows.map((r) => r.discId).sort()).toEqual(['a', 'b']);
  });

  it('sin filtros derivados activos, usa el camino barato (no proyecta discos fuera de la página)', async () => {
    const proyeccionesPorId: Record<string, ProyeccionDisco> = {
      a: proyeccionFixture({ discId: 'a' }),
      b: proyeccionFixture({ discId: 'b' }),
    };
    const service = crearServicioConDiscos(proyeccionesPorId);
    const proyectarDiscoMock = (
      service as unknown as {
        calculator: { proyectarDisco: jest.Mock };
      }
    ).calculator.proyectarDisco;

    await service.listarDiscos({ page: 1, pageSize: 1 });

    // pageSize=1 con 2 discos en el scope -> solo 1 debería proyectarse.
    expect(proyectarDiscoMock).toHaveBeenCalledTimes(1);
  });
});

describe('ProyeccionService.listarDiscos — filtros nuevos de eje/rueda/lado/motivo/responsable', () => {
  function crearServicioConDiscos(
    proyeccionesPorId: Record<string, ProyeccionDisco>,
  ) {
    const discos = Object.keys(proyeccionesPorId).map((id) =>
      discoBrakeFixture({ id, trenNumero: 1 }),
    );
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(proyeccionesPorId[discId]),
      ),
    } as unknown as ProyeccionCalculatorService;
    return new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
  }

  it('eje/rueda/lado se aplican como WHERE nativo de BrakeDisc (reutilizando empujarRango), no como filtro derivado', async () => {
    const findManyMock = jest.fn((args: { where: unknown }) => {
      void args;
      return Promise.resolve([]);
    });
    const prisma = {
      brakeDisc: {
        findMany: findManyMock,
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      { proyectarDisco: jest.fn() } as unknown as ProyeccionCalculatorService,
      crearBrakeDiscRules(),
    );

    await service.listarDiscos({
      page: 1,
      pageSize: 25,
      ejeMin: 2,
      ejeMax: 4,
      ruedaMin: 1,
      ruedaMax: 1,
      lado: ['derecho'],
    });

    expect(findManyMock.mock.calls[0][0].where).toEqual({
      activo: true,
      stage: 'en_servicio',
      wagonUnit: { tren: { modelo: 'alstom_metropolis9000' } },
      lado: { in: ['derecho'] },
      AND: [
        { ejeNumero: { gte: 2, lte: 4 } },
        { ruedaNumero: { gte: 1, lte: 1 } },
      ],
    });
  });

  it('lado reduce el scope ANTES de proyectar — el camino barato sigue activo (no dispara filtros derivados)', async () => {
    const soloDerecho = [
      discoBrakeFixture({ id: 'der', trenNumero: 1, lado: 'derecho' }),
    ];
    const findManyMock = jest.fn().mockResolvedValue(soloDerecho);
    const prisma = {
      brakeDisc: {
        findMany: findManyMock,
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(proyeccionFixture({ discId })),
      ),
    } as unknown as ProyeccionCalculatorService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      lado: ['derecho'],
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['der']);
  });

  it('responsable filtra por la ÚLTIMA MEDICIÓN del disco (filtro derivado, insensible a mayúsculas)', async () => {
    const service = crearServicioConDiscos({
      juan: proyeccionFixture({
        discId: 'juan',
        responsableUltimaMedicion: 'Juan Pérez',
      }),
      ana: proyeccionFixture({
        discId: 'ana',
        responsableUltimaMedicion: 'ANA TORRES',
      }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      responsable: ['ana torres'],
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['ana']);
  });

  it('motivo filtra igual, también insensible a mayúsculas', async () => {
    const service = crearServicioConDiscos({
      reperfilado: proyeccionFixture({
        discId: 'reperfilado',
        motivoUltimaMedicion: 'Reperfilado',
      }),
      medicion: proyeccionFixture({
        discId: 'medicion',
        motivoUltimaMedicion: 'medición',
      }),
    });

    const resultado = await service.listarDiscos({
      page: 1,
      pageSize: 25,
      motivo: ['REPERFILADO'],
    });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['reperfilado']);
  });
});

describe('ProyeccionService.listarDiscos — Parte 2: campos del ciclo de reperfilado llegan al DTO de respuesta', () => {
  it('hEnEseMomento/tEnEseMomento/rdAntes/rdDespues viajan en ciclosReperfilado del response, no solo en el motor interno', async () => {
    const discos = [discoBrakeFixture({ id: 'd1', trenNumero: 1 })];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const proyeccion = proyeccionFixture({
      discId: 'd1',
      ciclosReperfilado: [
        {
          numero: 1,
          mesesHastaFecha: 3,
          fechaEstimada: new Date('2026-04-01T00:00:00.000Z'),
          hEnEseMomento: 1.6,
          tEnEseMomento: 3.6,
          rdAntes: 2.0,
          rdDespues: 1.2,
        },
      ],
    });
    const calculator = {
      proyectarDisco: jest.fn().mockResolvedValue(proyeccion),
    } as unknown as ProyeccionCalculatorService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });

    expect(resultado.rows[0].ciclosReperfilado[0]).toEqual({
      numero: 1,
      mesesHastaFecha: 3,
      fechaEstimada: '2026-04-01',
      hEnEseMomento: 1.6,
      tEnEseMomento: 3.6,
      rdAntes: 2.0,
      rdDespues: 1.2,
      fechaPropiaSiFueraIndependiente: null,
    });
  });
});

describe('ProyeccionService.listarDiscos — Parte 3: fecha antepuesta por el lado hermano', () => {
  function crearServicioConPar(
    izq: Partial<ProyeccionDisco>,
    der: Partial<ProyeccionDisco>,
    opciones: { findFirstDevuelveHermano?: boolean } = {},
  ) {
    const discos = [
      // ruedaNumero impar/par = izquierdo/derecho (misma convención física
      // que ladoPorRueda en el frontend) -> calcularOrdenFisico ordena
      // izquierdo antes que derecho de forma determinística, sin depender
      // del desempate por discId.
      discoBrakeFixture({
        id: 'izq',
        trenNumero: 1,
        lado: 'izquierdo',
        ruedaNumero: 1,
      }),
      discoBrakeFixture({
        id: 'der',
        trenNumero: 1,
        lado: 'derecho',
        ruedaNumero: 2,
      }),
    ];
    const findFirstMock = jest
      .fn()
      .mockResolvedValue(
        opciones.findFirstDevuelveHermano ? { id: 'der' } : null,
      );
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        findFirst: findFirstMock,
      },
    } as unknown as PrismaService;

    const proyecciones: Record<string, ProyeccionDisco> = {
      izq: proyeccionFixture({
        discId: 'izq',
        posicion: posicion({ lado: 'izquierdo' }),
        ...izq,
      }),
      der: proyeccionFixture({
        discId: 'der',
        posicion: posicion({ lado: 'derecho' }),
        ...der,
      }),
    };
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(proyecciones[discId]),
      ),
    } as unknown as ProyeccionCalculatorService;

    return {
      service: new ProyeccionService(
        prisma,
        crearRate(),
        calculator,
        crearBrakeDiscRules(),
      ),
      findFirstMock,
    };
  }

  it('izquierdo cicloCambio en 3 meses y derecho en 5 meses -> ambos muestran 3 meses; derecho trae fechaPropiaSiFueraIndependiente = su propio cálculo de 5 meses', async () => {
    const { service } = crearServicioConPar(
      {
        cicloCambio: {
          mesesHastaFecha: 3,
          fechaEstimada: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
      {
        cicloCambio: {
          mesesHastaFecha: 5,
          fechaEstimada: new Date('2026-06-01T00:00:00.000Z'),
        },
      },
    );

    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });
    const filaIzq = resultado.rows.find((r) => r.discId === 'izq')!;
    const filaDer = resultado.rows.find((r) => r.discId === 'der')!;

    // Ambos muestran "la" fecha más próxima (3 meses, del izquierdo) —
    // realmente pertenece al izquierdo, así que el derecho la toma prestada.
    expect(filaIzq.cicloCambio!.mesesHastaFecha).toBe(3);
    expect(filaIzq.cicloCambio!.fechaEstimada).toBe('2026-04-01');
    expect(filaDer.cicloCambio!.mesesHastaFecha).toBe(3);
    expect(filaDer.cicloCambio!.fechaEstimada).toBe('2026-04-01');

    // Izquierdo YA era el más próximo -- no lleva fecha propia (nada que
    // aclarar, ya es su propio cálculo).
    expect(filaIzq.cicloCambio!.fechaPropiaSiFueraIndependiente).toBeNull();
    // Derecho SÍ trae su propio cálculo independiente (5 meses) para el
    // tooltip del frontend.
    expect(filaDer.cicloCambio!.fechaPropiaSiFueraIndependiente).toBe(
      '2026-06-01',
    );
  });

  it('mismo criterio para el primer cicloReperfilado (numero=1) — nunca toca ciclosReperfilado[1..]', async () => {
    const cicloIzq1 = {
      numero: 1,
      mesesHastaFecha: 2,
      fechaEstimada: new Date('2026-03-01T00:00:00.000Z'),
      hEnEseMomento: 1.6,
      tEnEseMomento: 3.6,
      rdAntes: 2.0,
      rdDespues: 1.2,
    };
    const cicloIzq2 = {
      numero: 2,
      mesesHastaFecha: 10,
      fechaEstimada: new Date('2026-11-01T00:00:00.000Z'),
      hEnEseMomento: 1.6,
      tEnEseMomento: 2.8,
      rdAntes: 1.2,
      rdDespues: 0.4,
    };
    const cicloDer1 = {
      numero: 1,
      mesesHastaFecha: 6,
      fechaEstimada: new Date('2026-07-01T00:00:00.000Z'),
      hEnEseMomento: 1.6,
      tEnEseMomento: 3.6,
      rdAntes: 2.0,
      rdDespues: 1.2,
    };
    const { service } = crearServicioConPar(
      { ciclosReperfilado: [cicloIzq1, cicloIzq2] },
      { ciclosReperfilado: [cicloDer1] },
    );

    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });
    const filaDer = resultado.rows.find((r) => r.discId === 'der')!;

    // El primer ciclo del derecho queda antepuesto por el del izquierdo
    // (más próximo, marzo vs. julio) — el objeto ENTERO es el del hermano.
    expect(filaDer.ciclosReperfilado[0]).toEqual({
      ...{
        numero: 1,
        mesesHastaFecha: 2,
        fechaEstimada: '2026-03-01',
        hEnEseMomento: 1.6,
        tEnEseMomento: 3.6,
        rdAntes: 2.0,
        rdDespues: 1.2,
      },
      fechaPropiaSiFueraIndependiente: '2026-07-01',
    });
    // El derecho no tiene un segundo ciclo -- no hay nada de qué anteponer
    // más allá del primero.
    expect(filaDer.ciclosReperfilado).toHaveLength(1);

    const filaIzq = resultado.rows.find((r) => r.discId === 'izq')!;
    // El izquierdo ya era el más próximo en su primer ciclo -- ninguno de
    // sus 2 ciclos se toca.
    expect(
      filaIzq.ciclosReperfilado[0].fechaPropiaSiFueraIndependiente,
    ).toBeNull();
    expect(
      filaIzq.ciclosReperfilado[1].fechaPropiaSiFueraIndependiente,
    ).toBeNull();
    expect(filaIzq.ciclosReperfilado[1].fechaEstimada).toBe('2026-11-01');
  });

  it('mismas fechas en ambos lados -> no antepone nada (ninguno lleva fechaPropiaSiFueraIndependiente)', async () => {
    const mismaFecha = new Date('2026-04-01T00:00:00.000Z');
    const { service } = crearServicioConPar(
      { cicloCambio: { mesesHastaFecha: 3, fechaEstimada: mismaFecha } },
      { cicloCambio: { mesesHastaFecha: 3, fechaEstimada: mismaFecha } },
    );

    const resultado = await service.listarDiscos({ page: 1, pageSize: 25 });

    for (const fila of resultado.rows) {
      expect(fila.cicloCambio!.fechaPropiaSiFueraIndependiente).toBeNull();
    }
  });

  it('el hermano se resuelve aparte (ad-hoc) cuando cae en otra página, sin que eso lo agregue a la respuesta', async () => {
    const { service, findFirstMock } = crearServicioConPar(
      {
        cicloCambio: {
          mesesHastaFecha: 3,
          fechaEstimada: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
      {
        cicloCambio: {
          mesesHastaFecha: 5,
          fechaEstimada: new Date('2026-06-01T00:00:00.000Z'),
        },
      },
      { findFirstDevuelveHermano: true },
    );

    // pageSize=1 -> solo el primero del orden físico (izquierdo) entra en
    // esta página; el derecho queda fuera del batch proyectado normalmente.
    const resultado = await service.listarDiscos({ page: 1, pageSize: 1 });

    expect(resultado.rows.map((r) => r.discId)).toEqual(['izq']);
    // El hermano SÍ se consultó (para poder comparar), aunque nunca aparece
    // en `rows` — no se fuerza su inclusión en la respuesta.
    expect(findFirstMock).toHaveBeenCalled();
    // 'izq' ya era el más próximo -- se muestra sin cambios.
    expect(resultado.rows[0].cicloCambio!.mesesHastaFecha).toBe(3);
    expect(
      resultado.rows[0].cicloCambio!.fechaPropiaSiFueraIndependiente,
    ).toBeNull();
  });
});

describe('ProyeccionService.obtenerPromedioPorVagon', () => {
  it('devuelve los 6 tipos de coche en orden físico, con su tasa', async () => {
    const prisma = {} as unknown as PrismaService;
    const rate = crearRate({ MA1: 0.3, MB3: 0.5 });
    const service = new ProyeccionService(
      prisma,
      rate,
      {} as unknown as ProyeccionCalculatorService,
      crearBrakeDiscRules(),
    );

    const resultado = await service.obtenerPromedioPorVagon();

    expect(resultado.map((r) => r.tipoCoche)).toEqual([
      'MA1',
      'MB1',
      'MB3',
      'REM',
      'MB2',
      'MA2',
    ]);
    expect(resultado.find((r) => r.tipoCoche === 'MA1')!.tasaPromedio).toBe(
      0.3,
    );
    expect(
      resultado.find((r) => r.tipoCoche === 'MB1')!.tasaPromedio,
    ).toBeNull();
  });
});

describe('ProyeccionService.obtenerPronostico', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('cuenta reperfilados/cambios en el mes calendario correcto y arma el desglose de estado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

    const discos = [discoBrakeFixture({ id: 'd1', trenNumero: 1 })];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        // Sin hermano en el fixture -> null (Parte 3, ver
        // resolverHermanoAdHoc): los tests de este archivo que no arman un
        // par izquierdo/derecho explícito no deben antepone nada.
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    // Un ciclo de reperfilado cayendo en marzo/2026 (mes índice 2) y un
    // cicloCambio cayendo en junio/2026 (mes índice 5).
    const proyeccion = proyeccionFixture({
      discId: 'd1',
      estado: 'SEGUIMIENTO',
      ciclosReperfilado: [
        {
          numero: 1,
          mesesHastaFecha: 2,
          fechaEstimada: new Date('2026-03-10T00:00:00.000Z'),
          hEnEseMomento: 1.6,
          tEnEseMomento: 3.6,
          rdAntes: 2.0,
          rdDespues: 1.2,
        },
      ],
      cicloCambio: {
        mesesHastaFecha: 5,
        fechaEstimada: new Date('2026-06-20T00:00:00.000Z'),
      },
    });
    const calculator = {
      proyectarDisco: jest.fn().mockResolvedValue(proyeccion),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const meses = await service.obtenerPronostico({ meses: 12 });

    expect(meses).toHaveLength(12);
    expect(meses[0].mes).toBe('2026-01');
    expect(meses[2].mes).toBe('2026-03');
    expect(meses[2].reperfilados).toBe(1);
    expect(meses[2].cambios).toBe(0);
    expect(meses[5].mes).toBe('2026-06');
    expect(meses[5].cambios).toBe(1);
    // El resto de los meses no tiene ningún evento de este disco.
    expect(meses[0].reperfilados).toBe(0);
    expect(meses[0].cambios).toBe(0);

    // El desglose de estado suma 1 disco en TODOS los meses (interpolado o
    // no) -- nunca se pierde ni se duplica.
    for (const mes of meses) {
      const suma =
        mes.desgloseEstado.ok +
        mes.desgloseEstado.seguimiento +
        mes.desgloseEstado.cambio +
        mes.desgloseEstado.critico +
        mes.desgloseEstado.reperfilado;
      expect(suma).toBe(1);
    }
  });

  it('un disco CRITICO no proyectable se cuenta como Cambio pendiente en el mes actual', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

    const discos = [discoBrakeFixture({ id: 'd1', trenNumero: 1 })];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        // Sin hermano en el fixture -> null (Parte 3, ver
        // resolverHermanoAdHoc): los tests de este archivo que no arman un
        // par izquierdo/derecho explícito no deben antepone nada.
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const proyeccion = proyeccionFixture({
      discId: 'd1',
      estado: 'CRITICO',
      proyectable: false,
      motivo: 'Sin datos suficientes...',
      tasaMensual: null,
      ciclosReperfilado: [],
      cicloCambio: null,
    });
    const calculator = {
      proyectarDisco: jest.fn().mockResolvedValue(proyeccion),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
    const meses = await service.obtenerPronostico({ meses: 12 });

    for (const [indice, mes] of meses.entries()) {
      expect(mes.desgloseEstado.critico).toBe(1);
      expect(mes.reperfilados).toBe(0);
      expect(mes.cambios).toBe(indice === 0 ? 1 : 0);
    }
  });

  // proyectarCiclos asume reperfilado instantáneo apenas H cruza el umbral,
  // así que interpolarEnFecha nunca devuelve REPERFILADO por sí solo — ni
  // siquiera para un disco que YA está en ese estado real hoy (ver el
  // comentario de estadoProyectadoEnMes). El estado real pendiente debe
  // tener el mismo tratamiento que CAMBIO pendiente: aparecer como evento
  // en el mes actual, incluso si la proyección no tiene ciclos disponibles.
  it('un disco YA en REPERFILADO real se cuenta como Reperfilado pendiente en el mes actual', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

    const discos = [discoBrakeFixture({ id: 'd1', trenNumero: 1 })];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const proyeccion = proyeccionFixture({
      discId: 'd1',
      estado: 'REPERFILADO',
      h: 1.8,
      t: 6.8,
      rd: 5.0,
      fechaUltimaMedicion: new Date('2026-01-01T00:00:00.000Z'),
      proyectable: false,
      tasaMensual: null,
      ciclosReperfilado: [],
      cicloCambio: null,
    });
    const calculator = {
      proyectarDisco: jest.fn().mockResolvedValue(proyeccion),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
    const meses = await service.obtenerPronostico({ meses: 12 });

    expect(meses[0].mes).toBe('2026-01');
    for (const [indice, mes] of meses.entries()) {
      expect(mes.desgloseEstado.reperfilado).toBe(indice === 0 ? 1 : 0);
      expect(mes.reperfilados).toBe(indice === 0 ? 1 : 0);
      expect(mes.cambios).toBe(0);
    }
  });

  // Punto 2 del enunciado: rango extendido de pronóstico — mismo shape de
  // response, agregación siempre MENSUAL, solo cambia la cantidad de filas
  // según `meses` (12/24/36/48/60, ver ProyeccionPronosticoQueryDto).
  it('meses=60 devuelve 60 filas mensuales (rango de 5 años)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

    const prisma = {
      brakeDisc: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn(),
    } as unknown as ProyeccionCalculatorService;

    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );
    const meses = await service.obtenerPronostico({ meses: 60 });

    expect(meses).toHaveLength(60);
    expect(meses[0].mes).toBe('2026-01');
    expect(meses[59].mes).toBe('2030-12');
  });

  it('meses=77 alcanza diciembre de 2032 desde agosto de 2026', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T00:00:00.000Z'));

    const prisma = {
      brakeDisc: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      { proyectarDisco: jest.fn() } as unknown as ProyeccionCalculatorService,
      crearBrakeDiscRules(),
    );

    const meses = await service.obtenerPronostico({ meses: 77 });

    expect(meses).toHaveLength(77);
    expect(meses[0].mes).toBe('2026-08');
    expect(meses[76].mes).toBe('2032-12');
  });

  it('devuelve eventos exactos del período con tipo y posición del disco', async () => {
    const discos = [
      discoBrakeFixture({
        id: 'd1',
        trenNumero: 7,
        tipoCoche: 'MB1',
        numeroCoche: 204,
        bogieCodigo: 'PB4',
        ejeNumero: 2,
        lado: 'derecho',
      }),
    ];
    const prisma = {
      brakeDisc: {
        findMany: jest.fn().mockResolvedValue(discos),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const calculator = {
      proyectarDisco: jest.fn().mockResolvedValue(
        proyeccionFixture({
          discId: 'd1',
          posicion: posicion({
            tipoCoche: 'MB1',
            numeroCoche: 204,
            bogieCodigo: 'PB4',
            ejeNumero: 2,
            lado: 'derecho',
          }),
          ciclosReperfilado: [
            {
              numero: 1,
              mesesHastaFecha: 1,
              fechaEstimada: new Date('2027-03-10T00:00:00.000Z'),
              hEnEseMomento: 1.6,
              tEnEseMomento: 3.6,
              rdAntes: 2,
              rdDespues: 1.2,
            },
          ],
          cicloCambio: {
            mesesHastaFecha: 1,
            fechaEstimada: new Date('2027-03-25T00:00:00.000Z'),
          },
        }),
      ),
    } as unknown as ProyeccionCalculatorService;
    const service = new ProyeccionService(
      prisma,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const todos = await service.obtenerDetallePronostico({
      periodo: '2027-03',
    });
    const cambios = await service.obtenerDetallePronostico({
      periodo: '2027',
      tipo: 'CAMBIO',
    });

    expect(todos).toEqual([
      expect.objectContaining({
        tipo: 'REPERFILADO',
        fechaEstimada: '2027-03-10',
        trenNumero: 7,
      }),
      expect.objectContaining({
        tipo: 'CAMBIO',
        fechaEstimada: '2027-03-25',
        trenNumero: 7,
      }),
    ]);
    expect(todos[0].posiciones).toEqual([
      expect.objectContaining({
        tipoCoche: 'MB1',
        numeroCoche: 204,
        bogieCodigo: 'PB4',
        ejeNumero: 2,
        lado: 'derecho',
      }),
    ]);
    expect(cambios).toEqual([
      expect.objectContaining({ tipo: 'CAMBIO', fechaEstimada: '2027-03-25' }),
    ]);
  });

  it('cuenta una intervención por eje y reúne izquierdo y derecho en el detalle', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T00:00:00.000Z'));
    const discos = [
      discoBrakeFixture({ id: 'izq', trenNumero: 3, lado: 'izquierdo' }),
      discoBrakeFixture({ id: 'der', trenNumero: 3, lado: 'derecho' }),
    ];
    const ciclo = (fechaEstimada: string) => ({
      numero: 1,
      mesesHastaFecha: 2,
      fechaEstimada: new Date(fechaEstimada),
      hEnEseMomento: 1.6,
      tEnEseMomento: 3.6,
      rdAntes: 2,
      rdDespues: 1.2,
    });
    const calculator = {
      proyectarDisco: jest.fn((discId: string) =>
        Promise.resolve(
          proyeccionFixture({
            discId,
            posicion: posicion({
              lado: discId === 'izq' ? 'izquierdo' : 'derecho',
            }),
            ciclosReperfilado: [
              ciclo(
                discId === 'izq'
                  ? '2026-03-10T00:00:00.000Z'
                  : '2026-04-10T00:00:00.000Z',
              ),
            ],
            cicloCambio: {
              mesesHastaFecha: 5,
              fechaEstimada: new Date(
                discId === 'izq'
                  ? '2026-06-10T00:00:00.000Z'
                  : '2026-07-10T00:00:00.000Z',
              ),
            },
          }),
        ),
      ),
    } as unknown as ProyeccionCalculatorService;
    const service = new ProyeccionService(
      {
        brakeDisc: { findMany: jest.fn().mockResolvedValue(discos) },
      } as unknown as PrismaService,
      crearRate(),
      calculator,
      crearBrakeDiscRules(),
    );

    const meses = await service.obtenerPronostico({ meses: 12 });
    const detalle = await service.obtenerDetallePronostico({
      periodo: '2026-03',
    });

    expect(meses.find((mes) => mes.mes === '2026-03')!.reperfilados).toBe(1);
    expect(meses.find((mes) => mes.mes === '2026-06')!.cambios).toBe(1);
    expect(detalle).toHaveLength(1);
    expect(
      detalle[0].posiciones.map((posicion) => posicion.lado).sort(),
    ).toEqual(['derecho', 'izquierdo']);
  });
});
