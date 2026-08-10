import type { PrismaService } from '../prisma/prisma.service';
import type { MeasurementGapConfigService } from './measurement-gap-config.service';
import { MeasurementGapService } from './measurement-gap.service';

type Registro = Record<string, unknown>;

// Mismo cálculo que MeasurementGapService (365.25/12 días promedio por mes) —
// repetido acá para poder ubicar una fecha EXACTAMENTE a N meses de "ahora",
// sin acoplar el test a la implementación interna del servicio.
const MS_POR_MES_PROMEDIO = (365.25 / 12) * 24 * 60 * 60 * 1000;
function haceMeses(ahora: Date, meses: number): Date {
  return new Date(ahora.getTime() - meses * MS_POR_MES_PROMEDIO);
}

function crearPrisma(
  scanRecords: Registro[],
  discos: Registro[],
): PrismaService {
  return {
    scanRecord: {
      findMany: jest.fn(() => Promise.resolve(scanRecords)),
    },
    brakeDisc: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          discos.filter((d) => where.id.in.includes(d.id as string)),
        ),
      ),
    },
  } as unknown as PrismaService;
}

function discoFixture(id: string, tren: number): Registro {
  return {
    id,
    bogieCodigo: 'PB3',
    ejeNumero: 1,
    lado: 'izquierdo',
    wagonUnit: {
      tipoCoche: 'MA1',
      numeroCoche: 101,
      tren: { numero: tren },
    },
  };
}

describe('MeasurementGapService.obtenerSummary', () => {
  // Mock suelto aparte del stub casteado: acceder a un método de una clase
  // real vía la instancia casteada dispara @typescript-eslint/unbound-method
  // aunque en runtime sea un jest.fn() (mismo criterio que crearRate en
  // proyeccion-calculator.service.spec.ts).
  const obtenerUmbralMesesMock = jest.fn();
  const configStub = {
    obtenerUmbralMeses: obtenerUmbralMesesMock,
  } as unknown as MeasurementGapConfigService;

  it('clasifica correctamente los límites exactos de 6 y 7 meses (umbral configurable=6, severo fijo=7)', async () => {
    const ahora = new Date('2026-06-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);

    const discos = [
      discoFixture('normal', 6), // justo debajo de 6 -> normal
      discoFixture('alerta-limite', 6), // EXACTO 6 -> alerta (>= umbral)
      discoFixture('alerta-alta', 6), // justo debajo de 7 -> alerta
      discoFixture('severa-limite', 6), // EXACTO 7 -> alertaSevera (>= 7, fijo)
      discoFixture('severa-alta', 6), // bien por encima de 7 -> alertaSevera
    ];
    const scanRecords = [
      { discId: 'normal', fecha: haceMeses(ahora, 5.9) },
      { discId: 'alerta-limite', fecha: haceMeses(ahora, 6) },
      { discId: 'alerta-alta', fecha: haceMeses(ahora, 6.9) },
      { discId: 'severa-limite', fecha: haceMeses(ahora, 7) },
      { discId: 'severa-alta', fecha: haceMeses(ahora, 10) },
    ];
    const prisma = crearPrisma(scanRecords, discos);
    const service = new MeasurementGapService(prisma, configStub);

    const resultado = await service.obtenerSummary(6);

    expect(resultado.umbralMesesUsado).toBe(6);
    expect(resultado.umbralSeveroMeses).toBe(7);
    expect(resultado.conteos).toEqual({
      normal: 1,
      alerta: 2,
      alertaSevera: 2,
    });

    // normal no se lista — solo alerta + alertaSevera (4 de los 5 discos).
    expect(resultado.discos).toHaveLength(4);
    expect(resultado.discos.map((d) => d.categoria).sort()).toEqual([
      'alerta',
      'alerta',
      'alertaSevera',
      'alertaSevera',
    ]);
    // mesesSinMedir redondeado a 1 decimal (ver FilaAlertaMeasurementGap) —
    // confirma que cada fila quedó pareada con su fecha correcta.
    expect(
      resultado.discos.map((d) => d.mesesSinMedir).sort((a, b) => a - b),
    ).toEqual([6, 6.9, 7, 10]);

    // config.obtenerUmbralMeses() nunca se llama: se pasó un override explícito.
    expect(obtenerUmbralMesesMock).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('sin override explícito, usa el umbral configurado en system_params', async () => {
    const ahora = new Date('2026-06-15T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);
    obtenerUmbralMesesMock.mockResolvedValue(4);

    const discos = [discoFixture('d1', 6)];
    const scanRecords = [{ discId: 'd1', fecha: haceMeses(ahora, 4.5) }];
    const prisma = crearPrisma(scanRecords, discos);
    const service = new MeasurementGapService(prisma, configStub);

    const resultado = await service.obtenerSummary();

    expect(resultado.umbralMesesUsado).toBe(4);
    expect(resultado.conteos.alerta).toBe(1); // 4.5 >= 4 (configurado) -> alerta

    jest.useRealTimers();
  });

  it('discos sin ninguna medición confirmada no aparecen (measurement-gap solo mira discos CON al menos 1 medición)', async () => {
    const prisma = crearPrisma([], []);
    const service = new MeasurementGapService(prisma, configStub);

    const resultado = await service.obtenerSummary(6);

    expect(resultado.conteos).toEqual({
      normal: 0,
      alerta: 0,
      alertaSevera: 0,
    });
    expect(resultado.discos).toEqual([]);
  });
});
