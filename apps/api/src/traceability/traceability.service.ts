import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { agruparPorMes, ordenarPorMes } from '../common/agrupar-por-mes';
import { PrismaService } from '../prisma/prisma.service';
import { ProyeccionConfigService } from '../projection/proyeccion-config.service';
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

// Rango de comparación para promedioRangoKm: un tramo de kilometraje ni tan
// corto (un diferenciaKm chico infla tasaMensual por extrapolación — mismo
// mecanismo que motivó excluir "Cambio"/"Pares montados de giro" en
// WearRateCalculatorService) ni tan largo (mezcla más tiempo/desgaste en un
// solo par, diluyendo variación real). No es un parámetro de negocio
// configurable (no vive en system_params): es un corte fijo para dar
// contexto adicional al promedio general, no reemplaza el consenso.
const KM_RANGO_INFERIOR = 7000;
const KM_RANGO_SUPERIOR = 15000;

// Piso técnico (NO estadístico) para poder calcular algo: la desviación
// estándar es muestral, divide por n-1 (ver traceability-stats.service.ts), así
// que con 1 valor da NaN y con 0 se rompe todo. Es distinto de CONTEO_MINIMO,
// que es el umbral de CONFIABILIDAD (20): entre 2 y 19 pares el cálculo sí se
// hace, pero se marca `confiable:false` para que la card lo advierta.
const CONTEO_MINIMO_CALCULABLE = 2;

export interface MetodoDescrito extends LimitesMetodo {
  formula: string;
}

// Promedio calculado APARTE, solo sobre los pares cuyo diferenciaKm cae en
// [kmMinimo, kmMaximo]: ese subconjunto define sus PROPIOS límites (Gauss/
// Percentiles/Tukey -> consenso) y su propio recorte, en vez de heredar el
// consenso del alcance completo. Por eso `consenso` acá casi nunca coincide
// con el consenso global del summary — es el punto de la card.
export interface PromedioRangoKm {
  kmMinimo: number;
  kmMaximo: number;
  // Pares válidos del alcance con diferenciaKm en el rango — el conjunto CRUDO
  // que alimenta a los 3 métodos de esta card (análogo del `conteo` global).
  conteo: number;
  // false si conteo < CONTEO_MINIMO: los límites se calculan igual, pero con
  // tan pocos puntos no tienen valor estadístico y la card lo advierte. Pasa
  // seguido al filtrar por tren+tipoCoche+bogie.
  confiable: boolean;
  // null solo si conteo < CONTEO_MINIMO_CALCULABLE (no hay con qué calcular).
  consenso: ConsensoLimites | null;
  // Pares que sobreviven al recorte/exclusión de ESE consenso — los que
  // efectivamente promedian.
  conteoLimpio: number;
  promedio: number | null;
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
  promedioRangoKm: PromedioRangoKm;
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

// Promedio de valorLimpio agrupado por tren (o toda la flota si `tren` es
// null) — mismo cálculo de "dato limpio" que promedioRangoKm/ProyeccionRateService
// (consenso Gauss∩Percentiles∩Tukey -> recorte/exclusión -> promedio), pero
// SIN filtrar por tipoCoche/bogieCodigo (fleet completo de ese tren) y SIN
// ningún recorte de km — ni el fijo de Trazabilidad ni el configurable de
// Proyección: el conjunto completo de pares válidos de ese tren. Por eso
// nunca se ve afectado por filtrarPorRangoKm (GET /traceability/summary y
// /series), ni siquiera acepta ese parámetro (ver
// TraceabilityPromedioPorTrenQueryDto).
export interface PromedioPorTren {
  tren: number | null;
  conteo: number;
  confiable: boolean;
  consenso: ConsensoLimites | null;
  conteoLimpio: number;
  promedio: number | null;
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
    // promedioRangoKm SIEMPRE parte de `filas` sin tocar (scope completo,
    // ver más abajo) — el filtro de este toggle solo afecta a
    // `filasParaCalculo`, nunca a esa card.
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
    // Rango FIJO propio de Trazabilidad (KM_RANGO_INFERIOR/SUPERIOR), sobre
    // el scope COMPLETO (`filas`, no `filasParaCalculo`) — independiente de
    // filtrarPorRangoKm, igual que promedio-por-tren/promedio-por-tipo-coche.
    const promedioRangoKm = this.calcularPromedioRangoKm(
      filas,
      fracciones,
      epsilon,
    );
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
      promedioRangoKm,
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

  // Cálculo INDEPENDIENTE del global: primero recorta el universo a los pares
  // dentro del rango de km, y recién sobre ESE subconjunto corre los 3 métodos
  // y el recorte. Heredar el consenso del alcance completo (lo que hacía la
  // versión anterior) daba un promedio de pares del rango pero limpiado con
  // límites que no salieron de ellos. SIEMPRE recibe el scope COMPLETO (nunca
  // pre-filtrado por filtrarPorRangoKm) — ver obtenerSummary.
  private calcularPromedioRangoKm(
    filas: {
      tasaMensual: Prisma.Decimal;
      fecha2: Date;
      diferenciaKm: Prisma.Decimal;
    }[],
    fracciones: FraccionesPercentil,
    epsilon: number,
  ): PromedioRangoKm {
    const enRango = filas.filter((f) => {
      const km = Number(f.diferenciaKm);
      return km >= KM_RANGO_INFERIOR && km <= KM_RANGO_SUPERIOR;
    });
    return {
      kmMinimo: KM_RANGO_INFERIOR,
      kmMaximo: KM_RANGO_SUPERIOR,
      ...this.calcularPromedioConsenso(enRango, fracciones, epsilon),
    };
  }

  // Promedio de valorLimpio sobre TODOS los pares válidos del tren pedido (o
  // de toda la flota si `tren` es undefined) — sin tipoCoche/bogieCodigo, sin
  // ningún recorte de km: el conjunto completo del scope. Mismo cálculo
  // (consenso Gauss∩Percentiles∩Tukey -> recorte/exclusión -> promedio) que
  // calcularPromedioRangoKm/ProyeccionRateService, factorizado acá para no
  // triplicar la lógica. Nunca acepta filtrarPorRangoKm (ver
  // TraceabilityPromedioPorTrenQueryDto) ni se ve afectado por él.
  async obtenerPromedioPorTren(tren?: number): Promise<PromedioPorTren> {
    const pares = await this.prisma.wearRatePair.findMany({
      where: {
        esValido: true,
        ...(tren !== undefined ? { trenNumero: tren } : {}),
      },
      select: { tasaMensual: true, fecha2: true },
    });
    const { fracciones, epsilon } = await this.obtenerConfigConsenso();

    return {
      tren: tren ?? null,
      ...this.calcularPromedioConsenso(pares, fracciones, epsilon),
    };
  }

  // Núcleo compartido de "promedio de dato limpio" (consenso propio del
  // subconjunto -> recorte/exclusión -> promedio de valorLimpio) — usado por
  // calcularPromedioRangoKm (recorte fijo de Trazabilidad) y
  // obtenerPromedioPorTren (sin recorte de km). `conteo`/`confiable` se
  // calculan igual en ambos casos (>= CONTEO_MINIMO); por debajo de
  // CONTEO_MINIMO_CALCULABLE no hay con qué calcular un consenso.
  private calcularPromedioConsenso(
    pares: { tasaMensual: Prisma.Decimal; fecha2: Date }[],
    fracciones: FraccionesPercentil,
    epsilon: number,
  ): {
    conteo: number;
    confiable: boolean;
    consenso: ConsensoLimites | null;
    conteoLimpio: number;
    promedio: number | null;
  } {
    const conteo = pares.length;
    const confiable = conteo >= CONTEO_MINIMO;

    if (conteo < CONTEO_MINIMO_CALCULABLE) {
      return {
        conteo,
        confiable,
        consenso: null,
        conteoLimpio: 0,
        promedio: null,
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
      conteo,
      confiable,
      consenso,
      conteoLimpio: limpios.length,
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
  // duplicado) — exclusivo de filtrarPorRangoKm en /summary y /series, jamás
  // usado por calcularPromedioRangoKm (rango fijo propio de Trazabilidad) ni
  // por obtenerPromedioPorTren (sin recorte de km).
  private async filtrarFilasPorRangoKm<
    T extends { diferenciaKm: Prisma.Decimal },
  >(filas: T[]): Promise<T[]> {
    const { kmMin, kmMax } = await this.proyeccionConfig.obtenerRangoKm();
    return filas.filter((f) => {
      const km = Number(f.diferenciaKm);
      return km >= kmMin && km <= kmMax;
    });
  }

  async obtenerSeries(
    q: TraceabilitySeriesQueryDto,
  ): Promise<TraceabilitySeriesResponse> {
    const where = this.construirWhereScope(q);
    const filas = await this.prisma.wearRatePair.findMany({
      where,
      select: { fecha2: true, tasaMensual: true, diferenciaKm: true },
      orderBy: { fecha2: 'asc' },
    });
    const filasParaCalculo = q.filtrarPorRangoKm
      ? await this.filtrarFilasPorRangoKm(filas)
      : filas;
    const conteoTotalHistorico = filasParaCalculo.length;

    // Mismo umbral que /summary: los límites se calculan siempre sobre el
    // histórico completo (nunca por periodo), así que si el histórico
    // completo no alcanza, tampoco alcanza para ningún periodo posible.
    if (conteoTotalHistorico < CONTEO_MINIMO) {
      return { datosInsuficientes: true, conteoTotalHistorico };
    }

    const valores = filasParaCalculo.map((f) => Number(f.tasaMensual));
    const { gauss, percentiles, tukey, consenso } =
      await this.calcularMetodos(valores);

    const desde = this.calcularFechaDesde(q.periodo);
    const filasPeriodo = desde
      ? filasParaCalculo.filter((f) => f.fecha2 >= desde)
      : filasParaCalculo;
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

  private async obtenerConfigConsenso() {
    const [fracciones, epsilon] = await Promise.all([
      this.consensoConfig.obtenerFracciones(),
      this.consensoConfig.obtenerEpsilon(),
    ]);
    return { fracciones, epsilon };
  }

  // Cálculo puro (sin I/O): recibe la config ya resuelta en vez de leerla. Se
  // separó de calcularMetodos porque obtenerSummary lo invoca DOS veces por
  // request (una sobre todo el alcance, otra sobre el subconjunto por rango de
  // km — ver calcularPromedioRangoKm) y releer system_params en cada una sería
  // trabajo duplicado sobre parámetros que no cambian dentro del request.
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
