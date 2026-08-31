import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type LadoDisco,
  type TipoCoche,
  type WearRatePair,
} from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { agruparPorMes, ordenarPorMes } from '../common/agrupar-por-mes';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';
import {
  paginarFiltrandoPorAccion,
  resolverAccionPorDiscId,
} from '../scan-records/accion-recomendada.query';
import { ConsensoConfigService } from '../traceability/consenso-config.service';
import { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { CONTEO_MINIMO } from '../traceability/traceability.service';
import type { WearRateChartQueryDto } from './dto/wear-rate-chart-query.dto';
import type { WearRatePairsQueryDto } from './dto/wear-rate-pairs-query.dto';
import type { WearRateSummaryQueryDto } from './dto/wear-rate-summary-query.dto';
import { WearRateCalculatorService } from './wear-rate-calculator.service';
import { construirWhereWearRate } from './wear-rate-pairs-query';

// Mismo valor que el seed de system_params (clave km_mensual): fallback si la
// fila no existe todavía o su valor no es numérico — nunca revienta por un
// parámetro no configurado (mismo patrón que UmbralesProviderService).
const KM_MENSUAL_POR_DEFECTO = 11_300;

// Mismo valor que el seed de system_params (clave tasa_desgaste_km_maximo):
// fallback si la fila no existe todavía o su valor no es numérico. Ver
// comentario de obtenerDiferenciaKmMaximaVigente() para el porqué de este
// umbral.
const DIFERENCIA_KM_MAXIMA_POR_DEFECTO = 50_000;

export interface FilaWearRateApi {
  id: string;
  discId: string;
  trenNumero: number;
  fecha1: string;
  km1: number;
  rd1: number;
  fecha2: string;
  km2: number;
  rd2: number;
  motivo2: string;
  diferenciaKm: number;
  diferenciaRd: number;
  tasa: number;
  tasaFormateada: string;
  kmMensualUsado: number;
  tasaMensual: number;
  tasaMensualFormateada: string;
  comentario: string;
  esValido: boolean;
  // Identidad del disco, denormalizada desde brake_discs/wagon_units al
  // insertar el par (ver recalcularDisco) — para la columna desplegable del
  // frontend, sin join en el listado.
  tipoCoche: TipoCoche;
  numeroCoche: number;
  bogieCodigo: string;
  ejeNumero: number;
  lado: LadoDisco;
}

export interface WearRatePairsResult {
  rows: FilaWearRateApi[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalPaginas: number;
}

export interface PuntoChartWearRate {
  mes: string;
  tasaMensualPromedio: number | null;
  paresValidos: number;
  paresInvalidos: number;
}

export interface MotivoInvalidezFrecuencia {
  motivo: string;
  cantidad: number;
}

export interface WearRateSummary {
  paresValidos: number;
  paresInvalidos: number;
  motivosFrecuentes: MotivoInvalidezFrecuencia[];
}

@Injectable()
export class WearRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculadora: WearRateCalculatorService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly stats: TraceabilityStatsService,
    private readonly consensoConfig: ConsensoConfigService,
  ) {}

  // --- Recálculo incremental (precomputado, ver WearRateCalculatorService) ---
  //
  // Se invoca tras confirmar nuevos ScanRecord (commit de migración masiva o,
  // a futuro, carga individual de un técnico) para cada disc_id afectado. NO
  // recalcula toda la tabla: por disco, solo genera los pares que faltan a
  // partir de la "frontera" (el último par ya guardado de ese disco), así que
  // el costo está acotado al historial de ESE disco, no al volumen total.
  async recalcularParaDiscos(discIds: Iterable<string>): Promise<void> {
    const unicos = [...new Set(discIds)];
    if (unicos.length === 0) return;

    const kmMensual = await this.obtenerKmMensualVigente();
    for (const discId of unicos) {
      await this.recalcularDisco(discId, kmMensual);
    }
  }

  private async recalcularDisco(
    discId: string,
    kmMensual: number,
  ): Promise<void> {
    const [ultimoPar, registros] = await Promise.all([
      this.prisma.wearRatePair.findFirst({
        where: { discId },
        orderBy: { fecha2: 'desc' },
      }),
      this.prisma.scanRecord.findMany({
        where: { discId },
        orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      }),
    ]);

    // La frontera es el extremo "nuevo" del último par ya guardado: los pares
    // nuevos empiezan justo después de esa medición. Sin pares previos,
    // arranca desde la primera medición del disco.
    let inicio = 0;
    if (ultimoPar) {
      const idx = registros.findIndex((r) => r.id === ultimoPar.scanRecordId2);
      inicio = idx === -1 ? registros.length : idx;
    }

    // Nada nuevo que emparejar: no hace falta resolver la identidad del disco.
    if (inicio >= registros.length - 1) return;

    // Identidad física del disco (tipo/número de coche, bogie, eje, lado),
    // denormalizada UNA sola vez por disco — no por par ni por request de
    // lectura — para no pagar un join en listados grandes de /wear-rate/pairs.
    const disco = await this.prisma.brakeDisc.findUniqueOrThrow({
      where: { id: discId },
      include: { wagonUnit: { include: { tren: true } } },
    });
    // tipoCoche/numeroCoche se resuelven vía wagonUnit, que solo existe
    // mientras la pieza está en_servicio (ver Operaciones/Inventario) — una
    // pieza retirada a almacén/taller no tiene mediciones nuevas que
    // emparejar de todos modos, así que no hay nada que recalcular.
    if (!disco.wagonUnit) return;
    // Ansaldo (y su pseudo-tren Reserva, mismo modelo) queda fuera de Tasa de
    // Desgaste/Trazabilidad/Proyección: esos 3 módulos asumen 2 discos por
    // eje y calcularían mal con el modelo Ansaldo (4 por eje) — generalizarlos
    // queda para un trabajo futuro dedicado. No generar WearRatePair acá
    // también protege gratis a Trazabilidad y Proyección, que leen de esta
    // tabla en vez de tocar ScanRecord/BrakeDisc directamente para las tasas.
    if (disco.wagonUnit.tren.modelo === 'ansaldo_mb300') return;
    const identidadDisco = {
      tipoCoche: disco.wagonUnit.tipoCoche,
      numeroCoche: disco.wagonUnit.numeroCoche,
      bogieCodigo: disco.bogieCodigo!,
      ejeNumero: disco.ejeNumero!,
      lado: disco.lado!,
      // Mismo cálculo que ScanRecord.ordenFisico (ver common/orden-fisico.ts)
      // — acá siempre resuelve limpio: tipoCoche/bogieCodigo/ejeNumero de un
      // BrakeDisc en_servicio nunca son texto libre ni nulos. ruedaNumero sí
      // puede ser null (no todos los discos históricos lo tienen cargado).
      ordenFisico: calcularOrdenFisico({
        tipoCoche: disco.wagonUnit.tipoCoche,
        bogieCodigo: disco.bogieCodigo!,
        ejeNumero: disco.ejeNumero!,
        ruedaNumero: disco.ruedaNumero,
      }),
    };

    const nuevos: Prisma.WearRatePairCreateManyInput[] = [];
    for (let i = inicio; i < registros.length - 1; i++) {
      const r1 = registros[i];
      const r2 = registros[i + 1];
      const calculado = this.calculadora.calcularPar({
        rd1: r1.rdValue,
        rd2: r2.rdValue,
        km1: Number(r1.kilometraje),
        km2: Number(r2.kilometraje),
        motivo2: r2.motivo,
        kmMensual,
      });

      nuevos.push({
        discId,
        scanRecordId1: r1.id,
        scanRecordId2: r2.id,
        trenNumero: r2.trenNumero,
        fecha1: r1.fecha,
        km1: r1.kilometraje,
        rd1: r1.rdValue,
        fecha2: r2.fecha,
        km2: r2.kilometraje,
        rd2: r2.rdValue,
        motivo2: r2.motivo,
        diferenciaKm: calculado.diferenciaKm,
        diferenciaRd: calculado.diferenciaRd,
        tasa: calculado.tasa,
        kmMensualUsado: kmMensual,
        tasaMensual: calculado.tasaMensual,
        comentario: calculado.comentario,
        esValido: calculado.esValido,
        ...identidadDisco,
      });
    }

    if (nuevos.length === 0) return;

    // skipDuplicates sobre @@unique([scanRecordId1, scanRecordId2]): defensa
    // adicional de idempotencia si esto se reintenta o corre concurrentemente
    // para el mismo disco. No reprocesa pares ya existentes de otros discos
    // porque cada llamada de este método está acotada a un único discId.
    await this.prisma.wearRatePair.createMany({
      data: nuevos,
      skipDuplicates: true,
    });
  }

  private async obtenerKmMensualVigente(): Promise<number> {
    const param = await this.prisma.systemParam.findUnique({
      where: { clave: 'km_mensual' },
    });
    const valor = param ? Number(param.valor) : NaN;
    return Number.isFinite(valor) ? valor : KM_MENSUAL_POR_DEFECTO;
  }

  // diferenciaKm (km2 - km1) que puede tener un par para entrar al promedio
  // de tasa mensual FLEET-WIDE de obtenerChart() — configurable vía
  // system_params (clave tasa_desgaste_km_maximo), con el mismo patrón de
  // fallback que obtenerKmMensualVigente(). El desglose "por tipo de coche"
  // ya no vive acá (ver TraceabilityService.obtenerSeriesPorTipoCoche), así
  // que este umbral no le aplica.
  //
  // Un par con un salto de km enorme entre sus 2 mediciones (discos con
  // historial disperso: a veces >90,000 km entre 2 confirmaciones) reparte
  // TODO el desgaste acumulado de ese tramo como si fuera constante mes a
  // mes (tasaMensual = diferenciaRd/diferenciaKm × kmMensual), inflando la
  // tasa "mensual" muy por encima de lo real. Cuando esto le pasa a VARIOS
  // discos del mismo tipo de coche en el mismo mes calendario (coincidencia
  // de cuándo se confirmó su siguiente medición, no un evento real de
  // desgaste), el propio consenso Gauss∩Percentiles∩Tukey de promedioLimpio
  // no los filtra como atípicos: sus límites se calculan sobre esa misma
  // muestra contaminada y terminan estirándose para "aceptarlos" (caso real:
  // MB3 abril 2026, 64 de 148 pares con diferenciaKm de 70,000-107,000 y
  // tasaMensual de 0.7-0.86, disparando el promedio del mes muy por encima
  // de los meses vecinos). Este umbral corta el problema en la fuente, antes
  // de que llegue al consenso.
  private async obtenerDiferenciaKmMaximaVigente(): Promise<number> {
    const param = await this.prisma.systemParam.findUnique({
      where: { clave: 'tasa_desgaste_km_maximo' },
    });
    const valor = param ? Number(param.valor) : NaN;
    return Number.isFinite(valor) ? valor : DIFERENCIA_KM_MAXIMA_POR_DEFECTO;
  }

  // Aplica el umbral de obtenerDiferenciaKmMaximaVigente() a un balde
  // mensual (fleet-wide) con una salvaguarda: si filtrar deja MENOS de la
  // mitad del balde original (o menos de CONTEO_MINIMO), se descarta el
  // filtro y se usa el balde completo sin filtrar.
  //
  // Motivo (bug real, detectado tras un reset de base de datos 2026-08): el
  // primer par de CADA disco recién importado enlaza su medición más antigua
  // con la más reciente, así que en los primeros meses con datos suficientes
  // TODO el balde puede tener un diferenciaKm igual de grande (ej. marzo 2026
  // tras el reset: 708 de 708 pares entre 70,000-97,500 km) — filtrar ahí no
  // corrige un dato contaminado, arrasa con el mes entero y deja una muestra
  // minúscula (20 sobrevivientes) que el consenso ya no puede promediar de
  // forma robusta (disparó tasaMensualPromedio a 0.82, muy por encima de los
  // meses vecinos ~0.07-0.15). El caso que este umbral SÍ debe seguir
  // corrigiendo (MB3 abril 2026: 64 de 148 pares "contaminados", con un
  // salto igual de grande, MEZCLADOS con 84 pares normales de intervalo
  // corto) queda intacto: ahí sobrevive más de la mitad del balde.
  private elegirParaPromedio<T extends { diferenciaKm: Prisma.Decimal }>(
    pares: T[],
    diferenciaKmMaxima: number,
  ): T[] {
    const filtrados = pares.filter(
      (p) => Number(p.diferenciaKm) <= diferenciaKmMaxima,
    );
    const usarFiltrados =
      filtrados.length >= Math.max(CONTEO_MINIMO, pares.length / 2);
    return usarFiltrados ? filtrados : pares;
  }

  // --- Endpoints de consulta (solo leen la tabla precomputada) ---

  async buscarPares(q: WearRatePairsQueryDto): Promise<WearRatePairsResult> {
    // WearRatePair no tiene columna estadoCalculado propia: estado[] se
    // traduce a un rango de rd2 con los umbrales vigentes (ver
    // rangoRd2ParaEstado en wear-rate-pairs-query.ts) — solo se resuelven si
    // hacen falta, para no pagar la consulta de más en el camino común.
    const umbrales = q.estado?.length
      ? await this.brakeDiscRules.obtenerUmbrales()
      : undefined;
    const where = construirWhereWearRate(q, umbrales);
    const orderBy = this.construirOrderBy(q);

    // accionRecomendada tampoco es una columna (se calcula cruzando discos,
    // vía discId — ver resolverAccionPorDiscId): con ese filtro activo hay
    // que traer TODO lo que matchea el resto de filtros, enriquecer, filtrar
    // y recién ahí paginar en memoria (mismo patrón que MigrationPreviewService
    // /ScanRecordsService). Sin ese filtro, sigue paginando en la base.
    if (q.accionRecomendada?.length) {
      const filas = await this.prisma.wearRatePair.findMany({
        where,
        orderBy,
      });
      const evaluador = await this.brakeDiscRules.obtenerEvaluador();
      const discIds = [...new Set(filas.map((f) => f.discId))];
      const accionPorDisco = await resolverAccionPorDiscId(
        this.prisma,
        discIds,
        evaluador,
      );
      // Filtra sobre las filas CRUDAS (no sobre FilaWearRateApi ya mapeada):
      // accionRecomendada nunca se expone en el response de /wear-rate/pairs
      // (solo se usa para filtrar), así que no hace falta pagarla en las
      // filas que ni siquiera van a sobrevivir el filtro.
      const { rows, total, totalPages } = paginarFiltrandoPorAccion(
        filas,
        (f) => accionPorDisco.get(f.discId)?.accion ?? null,
        q.accionRecomendada,
        q.page,
        q.pageSize,
      );
      return {
        rows: rows.map((f) => this.aFilaApi(f)),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages,
        totalPaginas: totalPages,
      };
    }

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.wearRatePair.count({ where }),
      this.prisma.wearRatePair.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    return {
      rows: filas.map((f) => this.aFilaApi(f)),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      totalPaginas: totalPages,
    };
  }

  // Sin sortBy explícito: mismo orden físico predefinido que scan-records
  // (tren, luego coche/bogie/eje/lado reales — ver common/orden-fisico.ts).
  private construirOrderBy(
    q: WearRatePairsQueryDto,
  ): Prisma.WearRatePairOrderByWithRelationInput[] {
    return q.sortBy !== undefined
      ? [{ [q.sortBy]: q.sortDir }, { id: 'asc' }]
      : [{ trenNumero: 'asc' }, { ordenFisico: 'asc' }, { id: 'asc' }];
  }

  // Serie mensual de tasa de desgaste promedio (solo pares válidos), más el
  // conteo de válidos/inválidos de cada mes para contexto en el gráfico.
  //
  // El mes calendario EN CURSO nunca entra (ver inicioMesActualUtc): todavía
  // está acumulando pares, así que promediarlo mezclaría un dato parcial con
  // meses ya cerrados — un mes recién empezado con 5-10 pares es una muestra
  // chica donde un solo par ruidoso domina el promedio sin que el resto del
  // mes lo compense (pedido del usuario 2026-08: la línea se disparaba en el
  // mes en curso). Al excluirlo en la fuente, tanto este chart como el
  // último punto de la serie (que usa InicioOperativo para el KPI "Tasa
  // promedio por mes" vía .at(-1)) caen solos al último mes ya cerrado, sin
  // lógica aparte en el frontend.
  //
  // Sin filtro de tren (fleet-wide): mismo criterio robusto que Proyección
  // (mínimo de CONTEO_MINIMO pares + consenso Gauss∩Percentiles∩Tukey, ver
  // promedioLimpio) para que un mes con pocos pares no salga con ruido. Con
  // un tren puntual (modo "Por tren" de Tasa de Desgaste) la muestra mensual
  // es chica por diseño — un tren tiene un solo disco de cada tipo — así que
  // ahí se mantiene el promedio simple de siempre, sin el guard.
  async obtenerChart(q: WearRateChartQueryDto): Promise<PuntoChartWearRate[]> {
    const where: Prisma.WearRatePairWhereInput = {
      ...(q.tren !== undefined ? { trenNumero: q.tren } : {}),
      fecha2: { lt: this.inicioMesActualUtc() },
    };

    const [diferenciaKmMaxima, pares] = await Promise.all([
      this.obtenerDiferenciaKmMaximaVigente(),
      this.prisma.wearRatePair.findMany({
        where,
        select: {
          fecha2: true,
          tasaMensual: true,
          esValido: true,
          diferenciaKm: true,
        },
      }),
    ]);

    const porMes = agruparPorMes(
      pares,
      (p) => p.fecha2,
      () => ({
        validos: [] as {
          tasaMensual: Prisma.Decimal;
          fecha2: Date;
          diferenciaKm: Prisma.Decimal;
        }[],
        paresInvalidos: 0,
      }),
      (acumulado, p) => {
        if (p.esValido) acumulado.validos.push(p);
        else acumulado.paresInvalidos += 1;
        return acumulado;
      },
    );

    return Promise.all(
      ordenarPorMes(porMes).map(async ([mes, d]) => {
        // Ver comentario de elegirParaPromedio(): aplica el umbral de km
        // salvo que dejaría el balde del mes con muy pocos pares (ahí se usa
        // el balde completo, sin filtrar). Los descartados por km se suman a
        // "inválidos" del tooltip: tampoco contribuyeron al promedio.
        const elegidos = this.elegirParaPromedio(d.validos, diferenciaKmMaxima);
        return {
          mes,
          tasaMensualPromedio:
            q.tren === undefined
              ? await this.promedioSiSuficiente(elegidos)
              : this.promedioSimple(elegidos),
          paresValidos: elegidos.length,
          paresInvalidos:
            d.paresInvalidos + (d.validos.length - elegidos.length),
        };
      }),
    );
  }

  // Primer instante (UTC) del mes calendario en curso — cota superior de
  // obtenerChart() para excluir el mes todavía no cerrado (ver comentario
  // ahí). El desglose por tipo de coche ("Tasa de desgaste mensual por tipo
  // de coche" del dashboard) ya NO vive acá — se movió a
  // TraceabilityService.obtenerSeriesPorTipoCoche(), que reusa el consenso
  // de Trazabilidad sobre el histórico completo de cada tipo en vez de
  // recalcularlo por balde mes+tipo (más frágil ante un balde sesgado, ver
  // el historial de parches que tenía esta clase antes de la migración).
  private inicioMesActualUtc(): Date {
    const ahora = new Date();
    return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  }

  private promedioSimple(
    pares: { tasaMensual: Prisma.Decimal }[],
  ): number | null {
    return pares.length > 0
      ? pares.reduce((suma, p) => suma + Number(p.tasaMensual), 0) /
          pares.length
      : null;
  }

  // null si no hay al menos CONTEO_MINIMO pares en el balde (mes+tipo de
  // coche, o mes fleet-wide) — no hay con qué calcular un consenso con
  // sentido estadístico (mismo criterio que ProyeccionRateService).
  private async promedioSiSuficiente(
    pares: { tasaMensual: Prisma.Decimal; fecha2: Date }[],
  ): Promise<number | null> {
    if (pares.length < CONTEO_MINIMO) return null;
    return this.promedioLimpio(pares);
  }

  // Mismo cálculo de "dato limpio" que ProyeccionRateService.promedioLimpio
  // (consenso Gauss∩Percentiles∩Tukey -> recorte/exclusión de atípicos ->
  // promedio de valorLimpio): un par con diferenciaKm chico (que infla
  // tasaMensual) ya no puede dominar el promedio del balde sin que el resto
  // de las mediciones lo compense.
  private async promedioLimpio(
    pares: { tasaMensual: Prisma.Decimal; fecha2: Date }[],
  ): Promise<number | null> {
    const [fracciones, epsilon] = await Promise.all([
      this.consensoConfig.obtenerFracciones(),
      this.consensoConfig.obtenerEpsilon(),
    ]);

    const valores = pares.map((p) => Number(p.tasaMensual));
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
    // (mismo criterio que ProyeccionRateService.promedioLimpio).
    if (limpios.length === 0) return null;
    return limpios.reduce((s, v) => s + v, 0) / limpios.length;
  }

  async obtenerSummary(q: WearRateSummaryQueryDto): Promise<WearRateSummary> {
    const where: Prisma.WearRatePairWhereInput =
      q.tren !== undefined ? { trenNumero: q.tren } : {};

    const [paresValidos, paresInvalidos, filasInvalidas] = await Promise.all([
      this.prisma.wearRatePair.count({ where: { ...where, esValido: true } }),
      this.prisma.wearRatePair.count({ where: { ...where, esValido: false } }),
      this.prisma.wearRatePair.findMany({
        where: { ...where, esValido: false },
        select: { comentario: true },
      }),
    ]);

    // Los motivos se guardaron unidos con '; ' (ver WearRateCalculatorService)
    // — se separan de vuelta para contar frecuencia individual.
    const conteoMotivos = new Map<string, number>();
    for (const fila of filasInvalidas) {
      for (const motivo of fila.comentario.split('; ')) {
        conteoMotivos.set(motivo, (conteoMotivos.get(motivo) ?? 0) + 1);
      }
    }

    const motivosFrecuentes = [...conteoMotivos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, cantidad]) => ({ motivo, cantidad }));

    return { paresValidos, paresInvalidos, motivosFrecuentes };
  }

  private aFilaApi(f: WearRatePair): FilaWearRateApi {
    const tasa = Number(f.tasa);
    const tasaMensual = Number(f.tasaMensual);
    return {
      id: f.id,
      discId: f.discId,
      trenNumero: f.trenNumero,
      fecha1: f.fecha1.toISOString().slice(0, 10),
      km1: Number(f.km1),
      rd1: f.rd1,
      fecha2: f.fecha2.toISOString().slice(0, 10),
      km2: Number(f.km2),
      rd2: f.rd2,
      motivo2: f.motivo2,
      diferenciaKm: Number(f.diferenciaKm),
      diferenciaRd: f.diferenciaRd,
      tasa,
      tasaFormateada: this.calculadora.formatearTasa(tasa),
      kmMensualUsado: Number(f.kmMensualUsado),
      tasaMensual,
      tasaMensualFormateada: this.calculadora.formatearTasa(tasaMensual),
      comentario: f.comentario,
      esValido: f.esValido,
      tipoCoche: f.tipoCoche,
      numeroCoche: f.numeroCoche,
      bogieCodigo: f.bogieCodigo,
      ejeNumero: f.ejeNumero,
      lado: f.lado,
    };
  }
}
