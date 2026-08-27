import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConsensoValidationService } from '../traceability/consenso-validation.service';
import { SystemParamsCacheService } from './system-params-cache.service';
import { SystemParamsService } from './system-params.service';

type Registro = Record<string, unknown>;

interface PrismaMock {
  systemParam: Record<'findUnique' | 'findMany' | 'update', jest.Mock>;
  systemParamAudit: Record<'create', jest.Mock>;
  notification: Record<'createMany', jest.Mock>;
  $transaction: jest.Mock;
}

function primerArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

describe('SystemParamsService', () => {
  let service: SystemParamsService;
  let prisma: PrismaMock;
  let consensoValidation: { validarCambioPercentil: jest.Mock };
  let systemParamsCache: { invalidar: jest.Mock };

  beforeEach(async () => {
    prisma = {
      systemParam: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn((args: { data: Registro }) => ({
          clave: 'rd_umbral_ok',
          ...args.data,
        })),
      },
      systemParamAudit: { create: jest.fn() },
      notification: { createMany: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (arg as (tx: PrismaMock) => unknown)(prisma),
    );

    // Por defecto "aceptado sin ajustes": las claves no-percentil ni siquiera
    // deberían llamarlo (ver test dedicado más abajo).
    consensoValidation = {
      validarCambioPercentil: jest
        .fn()
        .mockResolvedValue({ tipo: 'aceptado', ajustes: [] }),
    };

    systemParamsCache = { invalidar: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SystemParamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConsensoValidationService, useValue: consensoValidation },
        { provide: SystemParamsCacheService, useValue: systemParamsCache },
      ],
    }).compile();

    service = moduleRef.get(SystemParamsService);
  });

  it('lista los parámetros marcando cuáles son editables', async () => {
    prisma.systemParam.findMany.mockResolvedValue([
      {
        clave: 'rd_umbral_ok',
        valor: '1',
        descripcion: null,
        actualizadoEn: new Date(),
      },
      {
        clave: 'clave_no_editable',
        valor: 'x',
        descripcion: null,
        actualizadoEn: new Date(),
      },
    ]);

    const res = await service.listar();

    // listar() también agrega los PARAMS_INICIALES_FALTANTES que no vinieron
    // en el mock (ver system-params.config.ts) — no hardcodeamos ese conteo
    // acá para no desalinearnos cada vez que se agrega una clave nueva ahí.
    const porClave = new Map(res.map((p) => [p.clave, p]));
    expect(porClave.get('rd_umbral_ok')).toMatchObject({ editable: true });
    expect(porClave.get('clave_no_editable')).toMatchObject({
      editable: false,
    });
    expect(res).toEqual(
      [...res].sort((a, b) => a.clave.localeCompare(b.clave)),
    );
  });

  it('actualiza un umbral numérico, refresca actualizadoPor/En y audita el cambio', async () => {
    prisma.systemParam.findUnique.mockResolvedValue({
      clave: 'rd_umbral_ok',
      valor: '1',
    });

    await service.actualizar('rd_umbral_ok', '1.20', 'admin-1');

    const dataUpd = primerArg<{ data: Registro }>(
      prisma.systemParam.update,
    ).data;
    expect(dataUpd.valor).toBe('1.2'); // se guarda la forma canónica del número
    expect(dataUpd.actualizadoPor).toBe('admin-1');
    expect(dataUpd.actualizadoEn).toBeInstanceOf(Date);

    const audit = primerArg<{ data: Registro }>(
      prisma.systemParamAudit.create,
    ).data;
    expect(audit).toMatchObject({
      clave: 'rd_umbral_ok',
      valorAnterior: '1',
      valorNuevo: '1.2',
      usuarioId: 'admin-1',
    });
  });

  it('NO audita cuando el valor no cambia (mismo número tras normalizar)', async () => {
    prisma.systemParam.findUnique.mockResolvedValue({
      clave: 'rd_umbral_ok',
      valor: '1',
    });

    await service.actualizar('rd_umbral_ok', '1.0', 'admin-1');

    expect(prisma.systemParam.update).toHaveBeenCalled();
    expect(prisma.systemParamAudit.create).not.toHaveBeenCalled();
  });

  it('acepta un valor válido del enum outlier_metodo', async () => {
    prisma.systemParam.findUnique.mockResolvedValue({
      clave: 'outlier_metodo',
      valor: 'iqr',
    });

    await service.actualizar('outlier_metodo', 'umbral_fijo', 'admin-1');

    const dataUpd = primerArg<{ data: Registro }>(
      prisma.systemParam.update,
    ).data;
    expect(dataUpd.valor).toBe('umbral_fijo');
  });

  it('rechaza un valor no numérico para un umbral', async () => {
    await expect(
      service.actualizar('rd_umbral_ok', 'abc', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.systemParam.update).not.toHaveBeenCalled();
  });

  it('rechaza un valor fuera del enum de outlier_metodo', async () => {
    await expect(
      service.actualizar('outlier_metodo', 'promedio', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza dias_anticipacion_agenda no entero', async () => {
    await expect(
      service.actualizar('dias_anticipacion_agenda', '15.5', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza NotFound si la clave no es configurable', async () => {
    await expect(
      service.actualizar('clave_inventada', '1', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza NotFound si la clave es configurable pero no existe la fila', async () => {
    prisma.systemParam.findUnique.mockResolvedValue(null);
    await expect(
      service.actualizar('rd_umbral_ok', '1.2', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('validación de consenso (parámetros de percentil)', () => {
    it('una clave que NO es de percentil nunca dispara la validación de consenso', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'rd_umbral_ok',
        valor: '1',
      });

      const respuesta = await service.actualizar(
        'rd_umbral_ok',
        '1.2',
        'admin-1',
      );

      expect(consensoValidation.validarCambioPercentil).not.toHaveBeenCalled();
      expect(respuesta.ajustesConsenso).toEqual([]);
    });

    it('consenso_extremo_epsilon tampoco dispara la validación (no afecta gauss/percentiles/tukey)', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'consenso_extremo_epsilon',
        valor: '0.001',
      });

      await service.actualizar('consenso_extremo_epsilon', '0.005', 'admin-1');

      expect(consensoValidation.validarCambioPercentil).not.toHaveBeenCalled();
      expect(prisma.systemParam.update).toHaveBeenCalled();
    });

    it('Regla A: amplitud > 0.25 en alguna combinación rechaza con 422, sin persistir nada', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'percentil_limite_inferior',
        valor: '20',
      });
      consensoValidation.validarCambioPercentil.mockResolvedValue({
        tipo: 'rechazado',
        combinaciones: [{ scope: 'Tren 13 · MA1', amplitud: 0.3 }],
      });

      await expect(
        service.actualizar('percentil_limite_inferior', '5', 'admin-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(consensoValidation.validarCambioPercentil).toHaveBeenCalledWith(
        'percentil_limite_inferior',
        '5',
      );
      expect(prisma.systemParam.update).not.toHaveBeenCalled();
      expect(prisma.systemParamAudit.create).not.toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('Regla A: el 422 incluye qué combinación(es) violaron la regla', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'percentil_limite_inferior',
        valor: '20',
      });
      consensoValidation.validarCambioPercentil.mockResolvedValue({
        tipo: 'rechazado',
        combinaciones: [{ scope: 'Global (toda la flota)', amplitud: 0.3 }],
      });

      const respuesta = await service
        .actualizar('percentil_limite_inferior', '5', 'admin-1')
        .catch((err: UnprocessableEntityException) => err.getResponse());

      expect(respuesta).toMatchObject({
        combinaciones: [{ scope: 'Global (toda la flota)', amplitud: 0.3 }],
      });
    });

    it('Regla B: extremo inferior <= 0 en alguna combinación SÍ persiste el parámetro y crea una notificación de advertencia', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'percentil_extremo_inferior',
        valor: '10',
      });
      consensoValidation.validarCambioPercentil.mockResolvedValue({
        tipo: 'aceptado',
        ajustes: [
          {
            scope: 'Tren 13 · MA1 · Bogie PB3',
            valorOriginal: -0.01,
            epsilonAplicado: 0.001,
          },
        ],
      });

      const respuesta = await service.actualizar(
        'percentil_extremo_inferior',
        '25',
        'admin-1',
      );

      // El parámetro SÍ se guarda (la corrección es sobre el consenso, no un
      // bloqueo del cambio).
      const dataUpd = primerArg<{ data: Registro }>(
        prisma.systemParam.update,
      ).data;
      expect(dataUpd.valor).toBe('25');

      const notif = primerArg<{ data: Registro[] }>(
        prisma.notification.createMany,
      ).data;
      expect(notif).toHaveLength(1);
      expect(notif[0]).toMatchObject({
        tipo: 'consenso_extremo_ajustado',
        severidad: 'advertencia',
        rolDestino: 'administrador',
      });
      expect(notif[0].mensaje).toContain('Tren 13 · MA1 · Bogie PB3');
      expect(notif[0].mensaje).toContain('0.001');

      // La respuesta 200 también trae el ajuste — el frontend lo muestra
      // inline sin depender de un endpoint de notificaciones aparte.
      expect(respuesta.ajustesConsenso).toEqual([
        {
          scope: 'Tren 13 · MA1 · Bogie PB3',
          valorOriginal: -0.01,
          epsilonAplicado: 0.001,
        },
      ]);
    });

    it('Regla A y B en la misma combinación: Regla A gana, se rechaza sin aplicar el ajuste de epsilon', async () => {
      // ConsensoValidationService ya resuelve esta prioridad internamente
      // (ver consenso-validation.service.ts) — acá solo se confirma que
      // SystemParamsService respeta el veredicto 'rechazado' tal cual, sin
      // aplicar ningún ajuste aunque el resultado pudiera traer alguno.
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'percentil_extremo_inferior',
        valor: '10',
      });
      consensoValidation.validarCambioPercentil.mockResolvedValue({
        tipo: 'rechazado',
        combinaciones: [{ scope: 'Tren 13 · MA1', amplitud: 0.3 }],
      });

      await expect(
        service.actualizar('percentil_extremo_inferior', '50', 'admin-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('sin violaciones ni ajustes: persiste el parámetro y no crea ninguna notificación', async () => {
      prisma.systemParam.findUnique.mockResolvedValue({
        clave: 'percentil_limite_superior',
        valor: '60',
      });
      consensoValidation.validarCambioPercentil.mockResolvedValue({
        tipo: 'aceptado',
        ajustes: [],
      });

      const respuesta = await service.actualizar(
        'percentil_limite_superior',
        '65',
        'admin-1',
      );

      expect(prisma.systemParam.update).toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(respuesta.ajustesConsenso).toEqual([]);
    });
  });
});
