import { Test } from '@nestjs/testing';
import { ModuloSnapshot, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ProyeccionService } from '../projection/proyeccion.service';
import { TraceabilityService } from '../traceability/traceability.service';
import { GenerarSnapshotService } from './generar-snapshot.service';

interface FakeSnapshot {
  id: string;
  modulo: string;
  mesAnio: string;
  datosCompletos: unknown;
  generadoEn: Date;
  generadoPor: string | null;
}

interface DatosCrearSnapshot {
  modulo: string;
  mesAnio: string;
  datosCompletos: unknown;
  generadoPor: string | null;
}

function mesAnioDeHoy(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

// Mismo truco que ya usan otros specs de este repo para simular un choque de
// unicidad real de Postgres sin depender del constructor completo de la
// clase real (que en Prisma 7 pide clientVersion/meta) — un objeto con el
// prototype correcto ya basta para que `instanceof` (ver
// GenerarSnapshotService.esViolacionUnicidad) lo reconozca.
function crearErrorUnicidad(): Prisma.PrismaClientKnownRequestError {
  const err = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype,
  ) as Prisma.PrismaClientKnownRequestError;
  Object.assign(err, { code: 'P2002', message: 'Unique constraint failed' });
  return err;
}

// Fake de PrismaService con estado en memoria real (no solo jest.fn ciegos) —
// mismo criterio que migration-commit.service.spec.ts: permite verificar
// entre 2 llamadas independientes a generar() que el registro persiste tal
// como lo haría Postgres entre 2 invocaciones separadas.
function crearEntorno() {
  let snapshots: FakeSnapshot[] = [];
  let idSeq = 0;

  const moduleSnapshotApi = {
    findUnique: jest.fn(
      ({
        where,
      }: {
        where: { modulo_mesAnio: { modulo: string; mesAnio: string } };
      }): Promise<FakeSnapshot | null> => {
        const { modulo, mesAnio } = where.modulo_mesAnio;
        return Promise.resolve(
          snapshots.find((s) => s.modulo === modulo && s.mesAnio === mesAnio) ??
            null,
        );
      },
    ),
    create: jest.fn(
      ({ data }: { data: DatosCrearSnapshot }): Promise<FakeSnapshot> => {
        const creado: FakeSnapshot = {
          id: `snap-${++idSeq}`,
          modulo: data.modulo,
          mesAnio: data.mesAnio,
          datosCompletos: data.datosCompletos,
          generadoEn: new Date(),
          generadoPor: data.generadoPor,
        };
        snapshots.push(creado);
        return Promise.resolve(creado);
      },
    ),
    findFirst: jest.fn(
      ({
        where,
      }: {
        where: { modulo: string };
      }): Promise<FakeSnapshot | null> => {
        const filtrados = snapshots.filter((s) => s.modulo === where.modulo);
        if (filtrados.length === 0) return Promise.resolve(null);
        const [masReciente] = [...filtrados].sort(
          (a, b) => b.generadoEn.getTime() - a.generadoEn.getTime(),
        );
        return Promise.resolve(masReciente);
      },
    ),
  };

  return {
    prisma: { moduleSnapshot: moduleSnapshotApi },
    snapshots: {
      get: () => snapshots,
      set: (s: FakeSnapshot[]) => {
        snapshots = s;
      },
    },
  };
}

// Fixtures nombradas (en vez de leerlas después desde `.mock.results`, que
// jest tipa como `any` y dispara @typescript-eslint/no-unsafe-assignment):
// se reusan tal cual tanto para configurar los mocks como para armar el
// `datosCompletos` esperado en los asserts.
const RESUMEN_FIXTURE = {
  datosInsuficientes: false,
  conteo: 42,
  gauss: { limite: [0, 1], extremo: [0, 1] },
  percentiles: { limite: [0, 1], extremo: [0, 1] },
  tukey: { limite: [0, 1], extremo: [0, 1] },
  consenso: { limiteConsenso: [0, 1], extremoConsenso: [0, 1] },
  estadisticas: {
    media: 1,
    mediana: 1,
    moda: 1,
    desviacionEstandar: 0.1,
    minimo: 0,
    maximo: 2,
    conteo: 42,
  },
  paresTrasRecorte: 42,
  asimetria: { coeficiente: 0.1, clasificacion: 'simetrica' },
};

const PROMEDIO_POR_TREN_FIXTURE = [
  {
    tren: 6,
    promedio: 1.23,
    paresTrasRecorte: 40,
    conteoParesUsados: 42,
    datosLimitados: false,
  },
];

const PROMEDIO_POR_VAGON_FIXTURE = [{ tipoCoche: 'MA1', tasaPromedio: 0.5 }];

const DISCOS_FIXTURE = {
  rows: [],
  page: 1,
  pageSize: 100_000,
  total: 0,
  totalPages: 1,
  totalPaginas: 1,
};

const PRONOSTICO_FIXTURE: unknown[] = [];

function crearServicios() {
  const traceabilityFake = {
    obtenerSummary: jest.fn().mockResolvedValue(RESUMEN_FIXTURE),
    obtenerPromedioPorTren: jest
      .fn()
      .mockResolvedValue(PROMEDIO_POR_TREN_FIXTURE),
  };
  const proyeccionFake = {
    obtenerPromedioPorVagon: jest
      .fn()
      .mockResolvedValue(PROMEDIO_POR_VAGON_FIXTURE),
    listarDiscos: jest.fn().mockResolvedValue(DISCOS_FIXTURE),
    obtenerPronostico: jest.fn().mockResolvedValue(PRONOSTICO_FIXTURE),
  };
  return { traceabilityFake, proyeccionFake };
}

async function construirServicio(
  prisma: unknown,
  traceabilityFake: unknown,
  proyeccionFake: unknown,
): Promise<GenerarSnapshotService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      GenerarSnapshotService,
      { provide: PrismaService, useValue: prisma },
      { provide: TraceabilityService, useValue: traceabilityFake },
      { provide: ProyeccionService, useValue: proyeccionFake },
    ],
  }).compile();
  return moduleRef.get(GenerarSnapshotService);
}

describe('GenerarSnapshotService', () => {
  describe('generar', () => {
    it('crea un snapshot nuevo la primera vez que se invoca en el mes', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      const creado = await servicio.generar(ModuloSnapshot.trazabilidad);

      expect(creado.modulo).toBe('trazabilidad');
      expect(creado.mesAnio).toBe(mesAnioDeHoy());
      expect(creado.generadoPor).toBeNull();
      expect(entorno.snapshots.get()).toHaveLength(1);
      expect(entorno.prisma.moduleSnapshot.create).toHaveBeenCalledTimes(1);
    });

    // Test explícito del enunciado: dos invocaciones en el MISMO mes
    // calendario no crean un segundo registro y conservan el primero intacto.
    it('la segunda invocación en el mismo mes calendario no crea un segundo registro y conserva el primero intacto', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      const primero = await servicio.generar(ModuloSnapshot.trazabilidad);
      const segundo = await servicio.generar(ModuloSnapshot.trazabilidad);

      expect(segundo).toEqual(primero);
      expect(entorno.snapshots.get()).toHaveLength(1);
      expect(entorno.prisma.moduleSnapshot.create).toHaveBeenCalledTimes(1);
      // La segunda invocación no vuelve a recalcular nada: ni siquiera se
      // llama de nuevo a los cálculos de trazabilidad.
      expect(traceabilityFake.obtenerSummary).toHaveBeenCalledTimes(1);
      expect(traceabilityFake.obtenerPromedioPorTren).toHaveBeenCalledTimes(1);
    });

    it('trazabilidad y proyección son independientes: cada módulo tiene su propio snapshot del mes', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      const trazabilidad = await servicio.generar(ModuloSnapshot.trazabilidad);
      const proyeccion = await servicio.generar(ModuloSnapshot.proyeccion);

      expect(trazabilidad.modulo).toBe('trazabilidad');
      expect(proyeccion.modulo).toBe('proyeccion');
      expect(entorno.snapshots.get()).toHaveLength(2);
    });

    it('datosCompletos de trazabilidad junta summary, promedioPorTren y promedioPorVagon (fleet-wide, filtrarPorRangoKm=true)', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      const creado = await servicio.generar(ModuloSnapshot.trazabilidad);

      expect(traceabilityFake.obtenerSummary).toHaveBeenCalledWith({
        filtrarPorRangoKm: true,
      });
      expect(traceabilityFake.obtenerPromedioPorTren).toHaveBeenCalledWith(
        true,
        false,
      );
      expect(proyeccionFake.obtenerPromedioPorVagon).toHaveBeenCalledTimes(1);
      expect(creado.datosCompletos).toEqual({
        summary: RESUMEN_FIXTURE,
        promedioPorTren: PROMEDIO_POR_TREN_FIXTURE,
        promedioPorVagon: PROMEDIO_POR_VAGON_FIXTURE,
      });
    });

    it('datosCompletos de proyección junta TODOS los discos (sin paginar), el pronóstico 12 meses y el promedio por vagón', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      const creado = await servicio.generar(ModuloSnapshot.proyeccion);

      expect(proyeccionFake.listarDiscos).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100_000,
      });
      expect(proyeccionFake.obtenerPronostico).toHaveBeenCalledWith({
        meses: 12,
      });
      expect(creado.datosCompletos).toEqual({
        discos: DISCOS_FIXTURE,
        pronostico12Meses: PRONOSTICO_FIXTURE,
        promedioPorVagon: PROMEDIO_POR_VAGON_FIXTURE,
      });
    });

    it('una colisión real de unicidad en el create (2 disparadores en carrera) se resuelve devolviendo el snapshot que ganó la carrera', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );
      const mesAnio = mesAnioDeHoy();
      const err = crearErrorUnicidad();

      // Simula que, justo entre el findUnique() y el create() de ESTA
      // llamada, otro disparador (ej. SnapshotBootstrapService corriendo en
      // paralelo con MigrationCommitService) ya insertó el snapshot del mes.
      entorno.prisma.moduleSnapshot.create.mockImplementationOnce(() => {
        const ganador: FakeSnapshot = {
          id: 'snap-ganador-carrera',
          modulo: 'trazabilidad',
          mesAnio,
          datosCompletos: { ganadorDeLaCarrera: true },
          generadoEn: new Date(),
          generadoPor: null,
        };
        entorno.snapshots.get().push(ganador);
        return Promise.reject(err);
      });

      const resultado = await servicio.generar(ModuloSnapshot.trazabilidad);

      expect(resultado.id).toBe('snap-ganador-carrera');
      expect(entorno.snapshots.get()).toHaveLength(1);
    });
  });

  describe('obtenerUltimo', () => {
    it('devuelve null cuando todavía no se generó ningún snapshot del módulo', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );

      expect(
        await servicio.obtenerUltimo(ModuloSnapshot.trazabilidad),
      ).toBeNull();
    });

    it('devuelve el snapshot más reciente (por generadoEn) del módulo pedido, ignorando el otro módulo', async () => {
      const entorno = crearEntorno();
      const { traceabilityFake, proyeccionFake } = crearServicios();
      const servicio = await construirServicio(
        entorno.prisma,
        traceabilityFake,
        proyeccionFake,
      );
      entorno.snapshots.set([
        {
          id: 's1',
          modulo: 'trazabilidad',
          mesAnio: '2026-06',
          datosCompletos: {},
          generadoEn: new Date('2026-06-01T00:00:00Z'),
          generadoPor: null,
        },
        {
          id: 's2',
          modulo: 'trazabilidad',
          mesAnio: '2026-07',
          datosCompletos: {},
          generadoEn: new Date('2026-07-01T00:00:00Z'),
          generadoPor: null,
        },
        {
          id: 's3',
          modulo: 'proyeccion',
          mesAnio: '2026-07',
          datosCompletos: {},
          generadoEn: new Date('2026-07-15T00:00:00Z'),
          generadoPor: null,
        },
      ]);

      const resultado = await servicio.obtenerUltimo(
        ModuloSnapshot.trazabilidad,
      );

      expect(resultado?.id).toBe('s2');
    });
  });
});
