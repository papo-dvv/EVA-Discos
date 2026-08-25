import { Injectable } from '@nestjs/common';
import { Prisma, type TipoCoche } from '../../generated/prisma';
import { ORDEN_COCHE_FLOTA } from '../fleet/fleet.constants';
import { ConsensoConfigService } from '../traceability/consenso-config.service';
import { CONTEO_MINIMO } from '../traceability/traceability.service';
import { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProyeccionConfigService } from './proyeccion-config.service';

// Tasa promedio de desgaste (mm de Rd por mes, ver WearRateCalculatorService)
// por tipo de coche, fleet-wide (todos los trenes) — la base de la Proyección
// de Reperfilado y Cambio (ver ProyeccionCalculatorService: modela el
// crecimiento de H con esta misma magnitud). Reutiliza EXACTAMENTE el mismo
// cálculo de "dato limpio" que TraceabilityService.calcularPromedioRangoKm
// (consenso Gauss∩Percentiles∩Tukey -> recorte/exclusión -> promedio de
// valorLimpio) — mismo criterio, mismo umbral mínimo de 20 pares (ver
// CONTEO_MINIMO en traceability.service.ts) — pero agrupado por tipo_coche en
// vez de por scope tren/tipoCoche/bogieCodigo, y con el rango de km propio de
// Proyección (proyeccion_km_rango_min/max, ver ProyeccionConfigService) en vez
// del rango fijo de Trazabilidad.
@Injectable()
export class ProyeccionRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: TraceabilityStatsService,
    private readonly consensoConfig: ConsensoConfigService,
    private readonly proyeccionConfig: ProyeccionConfigService,
  ) {}

  // null si no hay al menos CONTEO_MINIMO pares válidos de ese tipo de coche
  // en el rango de km configurado — no hay con qué calcular un consenso con
  // sentido estadístico (mismo criterio que Trazabilidad).
  async calcularTasaPromedioPorTipoCoche(
    tipoCoche: TipoCoche,
  ): Promise<number | null> {
    const { kmMin, kmMax } = await this.proyeccionConfig.obtenerRangoKm();
    const pares = await this.prisma.wearRatePair.findMany({
      where: {
        esValido: true,
        tipoCoche,
        diferenciaKm: { gte: kmMin, lte: kmMax },
      },
      select: { tasaMensual: true, fecha2: true },
    });

    if (pares.length < CONTEO_MINIMO) return null;

    return this.promedioLimpio(pares);
  }

  // Los 6 tipos de coche Alstom a la vez (ORDEN_COCHE_FLOTA) — usado por GET
  // /projection/promedio-por-vagon y, para no repetir la misma consulta por
  // cada disco, por ProyeccionService al armar el listado y el pronóstico de
  // 12 meses. Ansaldo (M20/M21/M22) queda fuera a propósito — ver
  // ProyeccionService.resolverDiscosEnScope.
  async calcularTasasPorTipoCoche(): Promise<Record<TipoCoche, number | null>> {
    const tipos: readonly TipoCoche[] = ORDEN_COCHE_FLOTA;
    const tasas = await Promise.all(
      tipos.map((t) => this.calcularTasaPromedioPorTipoCoche(t)),
    );
    return Object.fromEntries(tipos.map((t, i) => [t, tasas[i]])) as Record<
      TipoCoche,
      number | null
    >;
  }

  private async promedioLimpio(
    pares: { tasaMensual: Prisma.Decimal; fecha2: Date }[],
  ): Promise<number | null> {
    const valores = pares.map((p) => Number(p.tasaMensual));
    const [fracciones, epsilon] = await Promise.all([
      this.consensoConfig.obtenerFracciones(),
      this.consensoConfig.obtenerEpsilon(),
    ]);

    const gauss = this.stats.calcularLimitesGauss(valores);
    const percentiles = this.stats.calcularLimitesPercentiles(
      valores,
      fracciones,
    );
    const tukey = this.stats.calcularLimitesTukey(valores);
    const consensoBruto = this.stats.calcularConsenso(
      gauss,
      percentiles,
      tukey,
    );
    const consenso = this.stats.aplicarPisoExtremoInferior(
      consensoBruto,
      epsilon,
    );

    const clasificados = this.stats.clasificarYLimpiarSerie(
      pares.map((p) => ({ fecha: p.fecha2, valor: Number(p.tasaMensual) })),
      consenso.limiteConsenso,
      consenso.extremoConsenso,
    );
    const limpios = clasificados
      .map((c) => c.valorLimpio)
      .filter((v): v is number => v !== null);

    // Defensivo: los límites salen de estos mismos valores, así que al menos
    // los centrales sobreviven — pero un 0/0 acá daría NaN en vez de fallar
    // (mismo criterio que calcularPromedioRangoKm en traceability.service.ts).
    if (limpios.length === 0) return null;
    return limpios.reduce((s, v) => s + v, 0) / limpios.length;
  }
}
