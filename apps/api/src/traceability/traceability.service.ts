import { Injectable } from '@nestjs/common';
import { Prisma, TipoCoche } from '../../generated/prisma';
import { agruparPorMes, ordenarPorMes } from '../common/agrupar-por-mes';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProyeccionConfigService,
  type RangoKmProyeccion,
} from '../projection/proyeccion-config.service';
import { AsimetriaConfigService } from './asimetria-config.service';
import { ConsensoConfigService } from './consenso-config.service';
import type { TraceabilityScopeQueryDto } from './dto/traceability-scope-query.dto';
import type {
  Agregacion,
  Periodo,
  TraceabilitySeriesQueryDto,
} from './dto/traceability-series-query.dto';
import {
  TraceabilityStatsService,
  type ClasificacionAsimetria,
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

// Rango de trenes de la flota Alstom (T06–T44, ver seed.ts) — GET
// /traceability/promedio-por-tren siempre recorre los 39, sin importar qué
// trenes tengan pares válidos hoy (un tren sin datos responde promedio:null,
// no se omite de la lista). Deja fuera a propósito los trenes Ansaldo (1-5)
// y el pseudo-tren Reserva (0): ese modelo tiene 4 discos por eje y este
// módulo asume 2 — generalizarlo queda para un trabajo futuro dedicado (ver
// mismo criterio en WearRateService.recalcularDisco y
// ProyeccionService.resolverDiscosEnScope).
const TREN_MINIMO = 6;
const TREN_MAXIMO = 44;

// Piso técnico (NO estadístico) para que el cálculo tenga sentido: con menos
// de 3 pares, Tukey (cuartiles) y el consenso no aportan nada confiable — se
// responde promedio:null en vez de forzar un número. Es distinto de
// CONTEO_MINIMO (20), que es el umbral de CONFIABILIDAD: entre 3 y 19 pares
// el cálculo sí se hace, pero se marca `datosLimitados:true`. Exclusivo de
// obtenerPromedioPorTren — obtenerSummary/obtenerSeries usan CONTEO_MINIMO
// como piso ABSOLUTO (ver más abajo), nunca calculan por debajo de 20.
const CONTEO_MINIMO_CALCULABLE_POR_TREN = 3;

export interface MetodoDescrito extends LimitesMetodo {
  formula: string;
}

export interface TraceabilitySummaryInsuficiente {
  datosInsuficientes: true;
  conteo: number;
}

// Coeficiente de Fisher-Pearson AJUSTADO (G1) sobre valorLimpio — mismo
// dataset que `estadisticas`. null solo si calcularAsimetria no puede operar
// (n<3, ver traceability-stats.service.ts); no debería pasar dado
// CONTEO_MINIMO=20, pero se cubre igual. `clasificacion` viaja null junto con
// `coeficiente` (no hay umbral que aplicar sin un coeficiente).
export interface AsimetriaResumen {
  coeficiente: number | null;
  clasificacion: ClasificacionAsimetria | null;
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
  // Mismo valor que estadisticas.conteo (longitud de valorLimpio tras
  // recorte/exclusión) pero expuesto en la raíz — el gráfico "Diagnóstico
  // completo" (GraficoTrazabilidad.tsx) lo consume directo, sin desanidar.
  paresTrasRecorte: number;
  asimetria: AsimetriaResumen;
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

// Mismo desglose que PromedioPorTrenItem pero acotado a un tipoCoche
// específico DENTRO de un tren (solo presente si incluirDetalle=true) — 6
// entradas por tren, una por cada valor de TipoCoche.
export interface PromedioPorTrenTipoCocheItem {
  tipoCoche: TipoCoche;
  promedio: number | null;
  paresTrasRecorte: number;
  conteoParesUsados: number;
  datosLimitados: boolean;
}

// Promedio de valorLimpio de UN tren (combinando todo tipoCoche/bogie) —
// mismo pipeline que /traceability/summary (Gauss∩Percentiles∩Tukey ->
// consenso -> recorte/exclusión -> promedio), aplicado por tren. A
// diferencia de /summary, NUNCA bloquea por CONTEO_MINIMO: con menos de
// CONTEO_MINIMO_CALCULABLE_POR_TREN pares el pipeline ni se corre (promedio
// null), pero con 3 o más SIEMPRE calcula, marcando datosLimitados si el
// conteo no alcanza los 20 de confiabilidad estadística.
export interface PromedioPorTrenItem {
  tren: number;
  promedio: number | null;
  // Pares que sobreviven al recorte/exclusión del consenso propio de este
  // tren — 0 si conteoParesUsados < CONTEO_MINIMO_CALCULABLE_POR_TREN (no se
  // llegó a calcular ningún consenso).
  paresTrasRecorte: number;
  // Pares válidos usados como universo de este tren (tras filtrarPorRangoKm
  // si aplica) — el conjunto CRUDO que alimenta al pipeline, antes de
  // cualquier recorte.
  conteoParesUsados: number;
  // true si conteoParesUsados < CONTEO_MINIMO (20): el promedio igual se
  // calculó (si conteoParesUsados >= 3), pero con pocos datos no tiene el
  // mismo respaldo estadístico — el frontend decide cómo advertirlo.
  datosLimitados: boolean;
  // Solo con incluirDetalle=true: mismo cálculo, scope tren+tipoCoche.
  porTipoCoche?: PromedioPorTrenTipoCocheItem[];
}

// Fila cruda que devuelve la primera consulta $queryRaw de obtenerSeries —
// todo NULL solo si conteo=0 (Postgres: AVG/STDDEV_SAMP/PERCENTILE_CONT sobre
// un conjunto vacío devuelven NULL), caso que el propio método corta ANTES de
// leer estos campos (conteo < CONTEO_MINIMO).
interface AgregadoSqlRow {
  conteo: number;
  media: number | null;
  desviacion: number | null;
  pctLi: number | null;
  pctLs: number | null;
  pctEi: number | null;
  pctEs: number | null;
  q1: number | null;
  q3: number | null;
}

interface FilaPeriodoSqlRow {
  fecha2: Date;
  tasaMensual: number;
}

@Injectable()
export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: TraceabilityStatsService,
    private readonly consensoConfig: ConsensoConfigService,
    private readonly asimetriaConfig: AsimetriaConfigService,
    private readonly proyeccionConfig: ProyeccionConfigService,
  ) {}

  async obtenerSummary(
    q: TraceabilityScopeQueryDto,
  ): Promise<TraceabilitySummaryResponse> {
    const where = this.construirWhereScope(q);
    const filas = await this.prisma.wearRatePair.findMany({
      where,
      select: { tasaMensual: true, fecha2: true, diferenciaKm: true },
    });
    const filasParaCalculo = q.filtrarPorRangoKm
      ? await this.filtrarFilasPorRangoKm(filas)
      : filas;
    const valores = filasParaCalculo.map((f) => Number(f.tasaMensual));

    if (valores.length < CONTEO_MINIMO) {
      return { datosInsuficientes: true, conteo: valores.length };
    }

    // La config se lee UNA vez y se reparte: el consenso global de acá abajo y
    // el del subconjunto por rango de km deben salir de los mismos parámetros.
    const { fracciones, epsilon } = await this.obtenerConfigConsenso();
    const { gauss, percentiles, tukey, consenso } = this.calcularMetodosCon(
      valores,
      fracciones,
      epsilon,
    );

    // Estadísticas generales sobre valorLimpio (post-recorte/exclusión del
    // propio consenso), NO sobre el valor crudo: mismo criterio de "dato
    // limpio" que ya aplica /traceability/series vía clasificarYLimpiarSerie
    // — sin esto, un outlier que la serie excluye igual inflaba media/desv.
    // estándar/mínimo/máximo del summary. `where` ya filtra esValido:true
    // (construirWhereScope) — los pares inválidos nunca llegan a `filas`.
    const clasificados = this.stats.clasificarYLimpiarSerie(
      filasParaCalculo.map((f) => ({
        fecha: f.fecha2,
        valor: Number(f.tasaMensual),
      })),
      consenso.limiteConsenso,
      consenso.extremoConsenso,
    );
    const valoresLimpios = clasificados
      .map((p) => p.valorLimpio)
      .filter((v): v is number => v !== null);
    const estadisticas =
      this.stats.calcularEstadisticasGenerales(valoresLimpios);
    const asimetria = await this.calcularAsimetriaResumen(valoresLimpios);

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
      paresTrasRecorte: valoresLimpios.length,
      asimetria,
    };
  }

  // Igual criterio de "dato limpio" que `estadisticas` (valorLimpio, post-
  // recorte/exclusión del propio consenso) — SOLO se aplica a /traceability,
  // nunca a Tasa de Desgaste ni a otro módulo. clasificacion queda null junto
  // con coeficiente cuando calcularAsimetria no puede operar (n<3).
  private async calcularAsimetriaResumen(
    valoresLimpios: number[],
  ): Promise<AsimetriaResumen> {
    const coeficiente = this.stats.calcularAsimetria(valoresLimpios);
    if (coeficiente === null) return { coeficiente: null, clasificacion: null };

    const umbral = await this.asimetriaConfig.obtenerUmbralSimetrica();
    return {
      coeficiente,
      clasificacion: this.stats.clasificarAsimetria(coeficiente, umbral),
    };
  }

  // Recorre los 39 trenes de la flota (TREN_MINIMO..TREN_MAXIMO, SIEMPRE los
  // 39, tenga o no pares un tren puntual) y calcula, para cada uno, el mismo
  // pipeline de "dato limpio" que /traceability/summary (Gauss∩Percentiles∩
  // Tukey -> consenso -> recorte/exclusión -> promedio), combinando todo
  // tipoCoche/bogie del tren. A diferencia de la versión anterior de este
  // endpoint, SÍ respeta filtrarPorRangoKm (mismo rango de Proyección que ya
  // usan /summary y /series — ver filtrarFilasPorRangoKm). Con
  // incluirDetalle=true agrega, por cada tren, el mismo cálculo acotado a
  // cada uno de los 6 TipoCoche. Siempre ordenado ascendente por tren
  // (6..44) porque así se arma el loop, sin necesidad de un sort aparte.
  async obtenerPromedioPorTren(
    filtrarPorRangoKm: boolean,
    incluirDetalle: boolean,
  ): Promise<PromedioPorTrenItem[]> {
    const filas = await this.prisma.wearRatePair.findMany({
      where: { esValido: true },
      select: {
        trenNumero: true,
        tipoCoche: true,
        tasaMensual: true,
        fecha2: true,
        diferenciaKm: true,
      },
    });
    const filasParaCalculo = filtrarPorRangoKm
      ? await this.filtrarFilasPorRangoKm(filas)
      : filas;
    const { fracciones, epsilon } = await this.obtenerConfigConsenso();

    const resultado: PromedioPorTrenItem[] = [];
    for (let tren = TREN_MINIMO; tren <= TREN_MAXIMO; tren++) {
      const paresTren = filasParaCalculo.filter((f) => f.trenNumero === tren);
      const item: PromedioPorTrenItem = {
        tren,
        ...this.calcularPromedioPorTrenItem(paresTren, fracciones, epsilon),
      };

      if (incluirDetalle) {
        item.porTipoCoche = Object.values(TipoCoche).map((tipoCoche) => ({
          tipoCoche,
          ...this.calcularPromedioPorTrenItem(
            paresTren.filter((f) => f.tipoCoche === tipoCoche),
            fracciones,
            epsilon,
          ),
        }));
      }

      resultado.push(item);
    }

    return resultado;
  }

  // Núcleo compartido del pipeline de /promedio-por-tren, en sus 2 alcances
  // (tren completo y tren+tipoCoche, ver incluirDetalle arriba). A
  // diferencia de calcularMetodosCon vía /summary, este endpoint NUNCA
  // bloquea devolviendo "datos insuficientes": con al menos
  // CONTEO_MINIMO_CALCULABLE_POR_TREN (3) pares SIEMPRE calcula, marcando
  // datosLimitados si el conteo no llega a CONTEO_MINIMO (20) — es la card
  // del frontend, no el backend, la que decide cómo advertir eso.
  private calcularPromedioPorTrenItem(
    pares: { tasaMensual: Prisma.Decimal; fecha2: Date }[],
    fracciones: FraccionesPercentil,
    epsilon: number,
  ): {
    promedio: number | null;
    paresTrasRecorte: number;
    conteoParesUsados: number;
    datosLimitados: boolean;
  } {
    const conteoParesUsados = pares.length;
    const datosLimitados = conteoParesUsados < CONTEO_MINIMO;

    if (conteoParesUsados < CONTEO_MINIMO_CALCULABLE_POR_TREN) {
      return {
        promedio: null,
        paresTrasRecorte: 0,
        conteoParesUsados,
        datosLimitados,
      };
    }

    const valores = pares.map((f) => Number(f.tasaMensual));
    const { consenso } = this.calcularMetodosCon(valores, fracciones, epsilon);
    const clasificados = this.stats.clasificarYLimpiarSerie(
      pares.map((f) => ({ fecha: f.fecha2, valor: Number(f.tasaMensual) })),
      consenso.limiteConsenso,
      consenso.extremoConsenso,
    );
    const limpios = clasificados
      .map((p) => p.valorLimpio)
      .filter((v): v is number => v !== null);

    return {
      paresTrasRecorte: limpios.length,
      conteoParesUsados,
      datosLimitados,
      // Defensivo: `limpios` no debería quedar vacío (los límites salen de
      // estos mismos valores, así que al menos los centrales sobreviven), pero
      // un 0/0 acá devolvería NaN y contaminaría la card en vez de fallar.
      promedio:
        limpios.length > 0
          ? limpios.reduce((s, v) => s + v, 0) / limpios.length
          : null,
    };
  }

  // Aplica el rango de km de PROYECCIÓN (proyeccion_km_rango_min/max, MISMO
  // parámetro que ProyeccionRateService — reutilizado tal cual, nunca
  // duplicado) — mismo criterio de filtrarPorRangoKm en /summary, /series Y
  // /promedio-por-tren (los 3 endpoints que aceptan el toggle).
  private async filtrarFilasPorRangoKm<
    T extends { diferenciaKm: Prisma.Decimal },
  >(filas: T[]): Promise<T[]> {
    const { kmMin, kmMax } = await this.proyeccionConfig.obtenerRangoKm();
    return filas.filter((f) => {
      const km = Number(f.diferenciaKm);
      return km >= kmMin && km <= kmMax;
    });
  }

  // Límites/consenso calculados por Postgres (AVG/STDDEV_SAMP/PERCENTILE_CONT)
  // en vez de traer el histórico COMPLETO del scope a memoria para promediarlo
  // en JS — con 39 trenes activos, ese histórico ya son >10K filas hoy y solo
  // crece. La equivalencia numérica con el cálculo JS de
  // TraceabilityStatsService está verificada a mano contra datos reales
  // (PERCENTILE_CONT usa la misma interpolación lineal que `percentil()` acá
  // — R-7 — así que coinciden EXACTO; AVG/STDDEV_SAMP difieren solo en ruido
  // de punto flotante de ~1e-16, muy por debajo de cualquier precisión que
  // esta pantalla muestra). Los puntos individuales para clasificar/graficar
  // SÍ se siguen trayendo por fila (ver más abajo), pero acotados al periodo
  // pedido, no al histórico completo.
  async obtenerSeries(
    q: TraceabilitySeriesQueryDto,
  ): Promise<TraceabilitySeriesResponse> {
    const { fracciones, epsilon } = await this.obtenerConfigConsenso();
    const rangoKm = q.filtrarPorRangoKm
      ? await this.proyeccionConfig.obtenerRangoKm()
      : null;
    const condiciones = this.condicionesScopeSql(q, rangoKm);

    const [agregado] = await this.prisma.$queryRaw<AgregadoSqlRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "conteo",
        (AVG(tasa_mensual))::float8 AS "media",
        (STDDEV_SAMP(tasa_mensual))::float8 AS "desviacion",
        (PERCENTILE_CONT(${fracciones.limiteInferior}) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "pctLi",
        (PERCENTILE_CONT(${fracciones.limiteSuperior}) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "pctLs",
        (PERCENTILE_CONT(${fracciones.extremoInferior}) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "pctEi",
        (PERCENTILE_CONT(${fracciones.extremoSuperior}) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "pctEs",
        (PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "q1",
        (PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY tasa_mensual))::float8 AS "q3"
      FROM wear_rate_pairs
      WHERE es_valido = true ${condiciones}
    `);
    const conteoTotalHistorico = agregado.conteo;

    // Mismo umbral que /summary: los límites se calculan siempre sobre el
    // histórico completo (nunca por periodo), así que si el histórico
    // completo no alcanza, tampoco alcanza para ningún periodo posible.
    if (conteoTotalHistorico < CONTEO_MINIMO) {
      return { datosInsuficientes: true, conteoTotalHistorico };
    }

    // Non-null: con conteoTotalHistorico >= CONTEO_MINIMO (20 filas),
    // Postgres siempre devuelve un valor para estos agregados sobre un
    // conjunto no vacío (nunca NULL salvo COUNT(*)=0).
    const media = agregado.media!;
    const desviacion = agregado.desviacion!;
    const gauss: LimitesMetodo = {
      limiteInferior: media - 2 * desviacion,
      limiteSuperior: media + 2 * desviacion,
      extremoInferior: media - 3 * desviacion,
      extremoSuperior: media + 3 * desviacion,
    };
    const percentiles: LimitesMetodo = {
      limiteInferior: agregado.pctLi!,
      limiteSuperior: agregado.pctLs!,
      extremoInferior: agregado.pctEi!,
      extremoSuperior: agregado.pctEs!,
    };
    const q1 = agregado.q1!;
    const q3 = agregado.q3!;
    const iqr = q3 - q1;
    const tukey: LimitesMetodo = {
      limiteInferior: q1 - 1.5 * iqr,
      limiteSuperior: q3 + 1.5 * iqr,
      extremoInferior: q1 - 3 * iqr,
      extremoSuperior: q3 + 3 * iqr,
    };
    const consensoBruto = this.stats.calcularConsenso(gauss, percentiles, tukey);
    const consenso = this.stats.aplicarPisoExtremoInferior(
      consensoBruto,
      epsilon,
    );

    const desde = this.calcularFechaDesde(q.periodo);
    const condicionFecha = desde
      ? Prisma.sql`AND fecha_2 >= ${desde}`
      : Prisma.empty;
    const filasPeriodo = await this.prisma.$queryRaw<FilaPeriodoSqlRow[]>(Prisma.sql`
      SELECT fecha_2 AS "fecha2", (tasa_mensual)::float8 AS "tasaMensual"
      FROM wear_rate_pairs
      WHERE es_valido = true ${condiciones} ${condicionFecha}
      ORDER BY fecha_2 ASC
    `);
    const conteoMostradoEnPeriodo = filasPeriodo.length;

    const puntosClasificados = this.stats.clasificarYLimpiarSerie(
      filasPeriodo.map((f) => ({
        fecha: f.fecha2,
        valor: f.tasaMensual,
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

  private async obtenerConfigConsenso() {
    const [fracciones, epsilon] = await Promise.all([
      this.consensoConfig.obtenerFracciones(),
      this.consensoConfig.obtenerEpsilon(),
    ]);
    return { fracciones, epsilon };
  }

  // Cálculo puro (sin I/O): recibe la config ya resuelta en vez de leerla. Se
  // separó de calcularMetodos porque obtenerPromedioPorTren lo invoca una vez
  // por cada tren (y, con incluirDetalle, por cada tren+tipoCoche — hasta 273
  // veces por request) y releer system_params en cada una sería trabajo
  // duplicado sobre parámetros que no cambian dentro del request.
  private calcularMetodosCon(
    valores: number[],
    fracciones: FraccionesPercentil,
    epsilon: number,
  ) {
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
    return { gauss, percentiles, tukey, consenso };
  }

  private async calcularMetodos(valores: number[]) {
    const { fracciones, epsilon } = await this.obtenerConfigConsenso();
    return {
      ...this.calcularMetodosCon(valores, fracciones, epsilon),
      fracciones,
    };
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

  // Equivalente SQL de construirWhereScope + filtro de rango de km, para las
  // 2 consultas $queryRaw de obtenerSeries — mismo criterio de scope (AND
  // entre las dimensiones presentes), armado con Prisma.sql para escapar los
  // valores de forma segura (nunca interpolación de texto cruda).
  private condicionesScopeSql(
    q: TraceabilityScopeQueryDto,
    rangoKm: RangoKmProyeccion | null,
  ): Prisma.Sql {
    const partes: Prisma.Sql[] = [];
    if (q.tren !== undefined) {
      partes.push(Prisma.sql`AND tren_numero = ${q.tren}`);
    }
    if (q.tipoCoche !== undefined) {
      partes.push(Prisma.sql`AND tipo_coche = ${q.tipoCoche}::"TipoCoche"`);
    }
    if (q.bogieCodigo !== undefined) {
      partes.push(Prisma.sql`AND bogie_codigo = ${q.bogieCodigo}`);
    }
    if (rangoKm) {
      partes.push(
        Prisma.sql`AND diferencia_km BETWEEN ${rangoKm.kmMin} AND ${rangoKm.kmMax}`,
      );
    }
    return partes.length > 0 ? Prisma.join(partes, ' ') : Prisma.empty;
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
