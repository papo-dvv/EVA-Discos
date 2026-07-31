import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { agruparPorMes, ordenarPorMes } from '../common/agrupar-por-mes';
import { PrismaService } from '../prisma/prisma.service';
import { ConsensoConfigService } from './consenso-config.service';
import type { TraceabilityScopeQueryDto } from './dto/traceability-scope-query.dto';
import type {
  Agregacion,
  Periodo,
  TraceabilitySeriesQueryDto,
} from './dto/traceability-series-query.dto';
import {
  TraceabilityStatsService,
  type ConsensoLimites,
  type EstadisticasGenerales,
  type FraccionesPercentil,
  type LimitesMetodo,
  type PuntoClasificado,
} from './traceability-stats.service';

// Por debajo de este conteo, cualquiera de los 3 métodos (sobre todo
// percentiles/Tukey) queda estadísticamente sin sentido — se rechaza el
// cálculo entero en vez de devolver límites poco confiables. Exportada:
// ConsensoValidationService usa el MISMO umbral para decidir qué
// combinaciones de scope entran a la validación de un cambio de percentil
// (ver enunciado: "combinaciones de scope con >=20 pares válidos").
export const CONTEO_MINIMO = 20;

// Umbral de agregacion='auto': por debajo, agrupar por mes un puñado de
// puntos no aporta nada y solo perdería granularidad para nada a cambio.
const UMBRAL_AGREGACION_MENSUAL = 100;

export interface MetodoDescrito extends LimitesMetodo {
  formula: string;
}

export interface TraceabilitySummaryInsuficiente {
  datosInsuficientes: true;
  conteo: number;
}

export interface TraceabilitySummaryResult {
  datosInsuficientes: false;
  conteo: number;
  gauss: MetodoDescrito;
  percentiles: MetodoDescrito;
  tukey: MetodoDescrito;
  consenso: ConsensoLimites;
  // media/mediana/moda/desviacionEstandar/minimo/maximo/conteo, TODOS sobre
  // valorLimpio (post-recorte/exclusión del propio consenso) — mismo
  // criterio de "dato limpio" que ya usa /traceability/series, para que
  // ambos endpoints describan el mismo dataset.
  estadisticas: EstadisticasGenerales;
}

export type TraceabilitySummaryResponse =
  TraceabilitySummaryInsuficiente | TraceabilitySummaryResult;

export interface PuntoSerieApi {
  fecha: string;
  tasaMensualCruda: number;
  estado: 'normal' | 'recortado' | 'excluido';
  valorLimpio: number | null;
}

// Un punto por mes calendario (agregacion='mensual'): promedio de valorLimpio
// de los puntos normal/recortado de ese mes — los excluidos ni entran al
// promedio ni se cuentan acá (ver TraceabilityService.agregarPorMes).
export interface PuntoMensualApi {
  mes: string; // YYYY-MM
  promedioValorLimpio: number;
  conteoNormal: number;
  conteoRecortado: number;
}

export interface TraceabilitySeriesInsuficiente {
  datosInsuficientes: true;
  conteoTotalHistorico: number;
}

interface TraceabilitySeriesResultBase {
  datosInsuficientes: false;
  gauss: LimitesMetodo;
  percentiles: LimitesMetodo;
  tukey: LimitesMetodo;
  consenso: ConsensoLimites;
  conteoTotalHistorico: number;
  conteoMostradoEnPeriodo: number;
}

export interface TraceabilitySeriesResultCrudo extends TraceabilitySeriesResultBase {
  agregacionAplicada: 'crudo';
  puntos: PuntoSerieApi[];
}

export interface TraceabilitySeriesResultMensual extends TraceabilitySeriesResultBase {
  agregacionAplicada: 'mensual';
  puntos: PuntoMensualApi[];
}

// Los límites/consenso NUNCA cambian con la agregación (punto 3 del
// enunciado) — por eso viven en la base compartida, no en cada variante.
export type TraceabilitySeriesResult =
  TraceabilitySeriesResultCrudo | TraceabilitySeriesResultMensual;

export type TraceabilitySeriesResponse =
  TraceabilitySeriesInsuficiente | TraceabilitySeriesResult;

@Injectable()
export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: TraceabilityStatsService,
    private readonly consensoConfig: ConsensoConfigService,
  ) {}

  async obtenerSummary(
    q: TraceabilityScopeQueryDto,
  ): Promise<TraceabilitySummaryResponse> {
    const where = this.construirWhereScope(q);
    const filas = await this.prisma.wearRatePair.findMany({
      where,
      select: { tasaMensual: true, fecha2: true },
    });
    const valores = filas.map((f) => Number(f.tasaMensual));

    if (valores.length < CONTEO_MINIMO) {
      return { datosInsuficientes: true, conteo: valores.length };
    }

    const { gauss, percentiles, tukey, consenso, fracciones } =
      await this.calcularMetodos(valores);

    // Estadísticas generales sobre valorLimpio (post-recorte/exclusión del
    // propio consenso), NO sobre el valor crudo: mismo criterio de "dato
    // limpio" que ya aplica /traceability/series vía clasificarYLimpiarSerie
    // — sin esto, un outlier que la serie excluye igual inflaba media/desv.
    // estándar/mínimo/máximo del summary. `where` ya filtra esValido:true
    // (construirWhereScope) — los pares inválidos nunca llegan a `filas`.
    const clasificados = this.stats.clasificarYLimpiarSerie(
      filas.map((f) => ({ fecha: f.fecha2, valor: Number(f.tasaMensual) })),
      consenso.limiteConsenso,
      consenso.extremoConsenso,
    );
    const valoresLimpios = clasificados
      .map((p) => p.valorLimpio)
      .filter((v): v is number => v !== null);
    const estadisticas =
      this.stats.calcularEstadisticasGenerales(valoresLimpios);

    return {
      datosInsuficientes: false,
      conteo: valores.length,
      gauss: {
        ...gauss,
        formula: 'Gauss: media ± 2σ (límite), media ± 3σ (extremo)',
      },
      percentiles: {
        ...percentiles,
        formula: this.formulaPercentiles(fracciones),
      },
      tukey: {
        ...tukey,
        formula:
          'Tukey: Q1−1.5×IQR / Q3+1.5×IQR (límite), Q1−3×IQR / Q3+3×IQR (extremo)',
      },
      consenso,
      estadisticas,
    };
  }

  async obtenerSeries(
    q: TraceabilitySeriesQueryDto,
  ): Promise<TraceabilitySeriesResponse> {
    const where = this.construirWhereScope(q);
    const filas = await this.prisma.wearRatePair.findMany({
      where,
      select: { fecha2: true, tasaMensual: true },
      orderBy: { fecha2: 'asc' },
    });
    const conteoTotalHistorico = filas.length;

    // Mismo umbral que /summary: los límites se calculan siempre sobre el
    // histórico completo (nunca por periodo), así que si el histórico
    // completo no alcanza, tampoco alcanza para ningún periodo posible.
    if (conteoTotalHistorico < CONTEO_MINIMO) {
      return { datosInsuficientes: true, conteoTotalHistorico };
    }

    const valores = filas.map((f) => Number(f.tasaMensual));
    const { gauss, percentiles, tukey, consenso } =
      await this.calcularMetodos(valores);

    const desde = this.calcularFechaDesde(q.periodo);
    const filasPeriodo = desde ? filas.filter((f) => f.fecha2 >= desde) : filas;
    const conteoMostradoEnPeriodo = filasPeriodo.length;

    const puntosClasificados = this.stats.clasificarYLimpiarSerie(
      filasPeriodo.map((f) => ({
        fecha: f.fecha2,
        valor: Number(f.tasaMensual),
      })),
      consenso.limiteConsenso,
      consenso.extremoConsenso,
    );

    const base = {
      datosInsuficientes: false as const,
      gauss,
      percentiles,
      tukey,
      consenso,
      conteoTotalHistorico,
      conteoMostradoEnPeriodo,
    };

    const agregacionAplicada = this.resolverAgregacion(
      q.agregacion,
      conteoMostradoEnPeriodo,
    );
    if (agregacionAplicada === 'mensual') {
      return {
        ...base,
        agregacionAplicada,
        puntos: this.agregarPorMes(puntosClasificados),
      };
    }

    return {
      ...base,
      agregacionAplicada,
      puntos: puntosClasificados.map((p) => ({
        fecha: p.fecha.toISOString().slice(0, 10),
        tasaMensualCruda: p.tasaMensualCruda,
        estado: p.estado,
        valorLimpio: p.valorLimpio,
      })),
    };
  }

  // 'crudo'/'mensual' fuerzan el modo pedido sin importar el conteo. 'auto'
  // decide según cuántos puntos habría en el tramo pedido (no el histórico
  // completo): un puñado de puntos se ve mejor crudo, un volumen grande se
  // ve mejor agregado — el mismo criterio de "conteo total en el periodo"
  // que ya expone conteoMostradoEnPeriodo.
  private resolverAgregacion(
    pedida: Agregacion,
    conteoEnPeriodo: number,
  ): 'crudo' | 'mensual' {
    if (pedida === 'crudo' || pedida === 'mensual') return pedida;
    return conteoEnPeriodo > UMBRAL_AGREGACION_MENSUAL ? 'mensual' : 'crudo';
  }

  // Agrupa por mes reutilizando el mismo mecanismo de bucketing que
  // WearRateService.obtenerChart (ver apps/api/src/common/agrupar-por-mes.ts)
  // — acá el acumulador es propio de trazabilidad (normal/recortado, nunca
  // válido/inválido) porque valorLimpio ya viene filtrado a "lo que sí entra
  // a la trazabilidad": los excluidos ni se cuentan ni entran al promedio.
  private agregarPorMes(puntos: PuntoClasificado[]): PuntoMensualApi[] {
    const incluidos = puntos.filter(
      (p): p is PuntoClasificado & { valorLimpio: number } =>
        p.valorLimpio !== null,
    );

    const porMes = agruparPorMes(
      incluidos,
      (p) => p.fecha,
      () => ({ suma: 0, conteoNormal: 0, conteoRecortado: 0 }),
      (acumulado, p) => {
        acumulado.suma += p.valorLimpio;
        if (p.estado === 'normal') acumulado.conteoNormal += 1;
        else acumulado.conteoRecortado += 1;
        return acumulado;
      },
    );

    return ordenarPorMes(porMes).map(([mes, d]) => ({
      mes,
      // d.conteoNormal + d.conteoRecortado nunca es 0: el balde solo existe
      // si al menos un punto incluido cayó en ese mes.
      promedioValorLimpio: d.suma / (d.conteoNormal + d.conteoRecortado),
      conteoNormal: d.conteoNormal,
      conteoRecortado: d.conteoRecortado,
    }));
  }

  private async calcularMetodos(valores: number[]) {
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
    // El extremo inferior de consenso nunca puede ser <= 0 (ver Regla B en
    // ConsensoValidationService) — se aplica SIEMPRE, no solo al validar un
    // cambio de parámetro, porque es una regla permanente del cálculo.
    const consenso = this.stats.aplicarPisoExtremoInferior(
      consensoBruto,
      epsilon,
    );
    return { gauss, percentiles, tukey, consenso, fracciones };
  }

  // Texto SIEMPRE derivado de los percentiles configurados vigentes (escala
  // 0-100, ej. 0.25 -> "P25") — nunca un literal fijo, para que no quede
  // desincronizado del cálculo real si alguien cambia percentil_limite_inferior
  // y compañía por PATCH /system-params (ver ConsensoConfigService).
  private formulaPercentiles(fracciones: FraccionesPercentil): string {
    const pct = (f: number) => Math.round(f * 100);
    return (
      `Percentiles: P${pct(fracciones.limiteInferior)}–P${pct(fracciones.limiteSuperior)} (límite), ` +
      `P${pct(fracciones.extremoInferior)}–P${pct(fracciones.extremoSuperior)} (extremo)`
    );
  }

  // SIEMPRE filtra es_valido=true: un par inválido tiene tasa forzada a 0
  // (ver WearRateCalculatorService) y contaminaría media/desviación/
  // percentiles sin ningún sentido estadístico. tren/tipoCoche/bogieCodigo
  // son dimensiones del scope, no filtros alternables: se combinan siempre
  // en AND (ninguno presente = toda la flota).
  private construirWhereScope(
    q: TraceabilityScopeQueryDto,
  ): Prisma.WearRatePairWhereInput {
    return {
      esValido: true,
      ...(q.tren !== undefined ? { trenNumero: q.tren } : {}),
      ...(q.tipoCoche !== undefined ? { tipoCoche: q.tipoCoche } : {}),
      ...(q.bogieCodigo !== undefined ? { bogieCodigo: q.bogieCodigo } : {}),
    };
  }

  // Ancla al "ahora" del servidor (no a la fecha más reciente del dataset):
  // "últimos 3 meses" en un dashboard en vivo se lee relativo a hoy, igual
  // que cualquier filtro de periodo convencional.
  private calcularFechaDesde(periodo: Periodo): Date | null {
    if (periodo === 'todo') return null;
    const desde = new Date();
    switch (periodo) {
      case '3m':
        desde.setMonth(desde.getMonth() - 3);
        break;
      case '6m':
        desde.setMonth(desde.getMonth() - 6);
        break;
      case '12m':
        desde.setMonth(desde.getMonth() - 12);
        break;
      case '2a':
        desde.setFullYear(desde.getFullYear() - 2);
        break;
    }
    return desde;
  }
}
