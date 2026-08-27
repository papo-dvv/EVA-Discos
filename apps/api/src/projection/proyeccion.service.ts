import { Injectable } from '@nestjs/common';
import { Prisma, TipoCoche, type LadoDisco } from '../../generated/prisma';
import {
  BrakeDiscRulesEngine,
  type EstadoDiscoAmpliado,
} from '../brake-disc-rules/brake-disc-rules.engine';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { ORDEN_COCHE_FLOTA } from '../fleet/fleet.constants';
import { PrismaService } from '../prisma/prisma.service';
import { empujarRango } from '../scan-records/scan-record-query';
import type {
  CicloCambio,
  CicloReperfilado,
} from './proyeccion-calculator.engine';
import {
  fechaCaeEnMes,
  generarMesesForecast,
  interpolarEnFecha,
  type MesForecast,
} from './proyeccion-calculator.engine';
import {
  ProyeccionCalculatorService,
  type PosicionDisco,
  type ProyeccionDisco,
  type UmbralesProyectarDisco,
} from './proyeccion-calculator.service';
import { ProyeccionRateService } from './proyeccion-rate.service';
import { ProyeccionUmbralesService } from './proyeccion-umbrales.service';
import type { ProyeccionDiscosQueryDto } from './dto/proyeccion-discos-query.dto';
import type { ProyeccionPronosticoQueryDto } from './dto/proyeccion-pronostico-query.dto';
import type {
  ProyeccionPronosticoDetalleQueryDto,
  TipoEventoPronostico,
} from './dto/proyeccion-pronostico-detalle-query.dto';

export interface CicloReperfiladoApi {
  numero: number;
  mesesHastaFecha: number;
  fechaEstimada: string;
  hEnEseMomento: number;
  tEnEseMomento: number;
  rdAntes: number;
  rdDespues: number;
  // Presente SOLO cuando este es el PRIMER ciclo (numero=1) Y realmente
  // pertenece al lado hermano de este eje (izquierdo/derecho) por ser más
  // próximo — ver ProyeccionService.resolverOverridesPorEje. En ese caso todo
  // lo de arriba (numero/fechaEstimada/hEnEseMomento/etc.) es LITERALMENTE el
  // ciclo del hermano, y acá viaja la fecha que este disco hubiera tenido si
  // se proyectara de forma independiente, para que el frontend arme el
  // tooltip sin recalcular nada. null en cualquier otro caso (ciclo propio).
  fechaPropiaSiFueraIndependiente: string | null;
}

export interface CicloCambioApi {
  mesesHastaFecha: number;
  fechaEstimada: string;
  // Mismo criterio que CicloReperfiladoApi.fechaPropiaSiFueraIndependiente,
  // aplicado al cicloCambio en vez de al primer ciclo de reperfilado.
  fechaPropiaSiFueraIndependiente: string | null;
}

export interface ProyeccionDiscoApi {
  discId: string;
  trenNumero: number;
  posicion: PosicionDisco;
  fechaUltimaMedicion: string;
  h: number;
  t: number;
  rd: number;
  estado: EstadoDiscoAmpliado;
  proyectable: boolean;
  motivo: string | null;
  ciclosReperfilado: CicloReperfiladoApi[];
  cicloCambio: CicloCambioApi | null;
}

export interface ProyeccionDiscosResult {
  rows: ProyeccionDiscoApi[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalPaginas: number;
}

export interface PromedioPorVagonApi {
  tipoCoche: TipoCoche;
  tasaPromedio: number | null;
}

export interface DesgloseEstadoApi {
  ok: number;
  seguimiento: number;
  cambio: number;
  critico: number;
  reperfilado: number;
}

export interface PronosticoMesApi {
  mes: string; // YYYY-MM
  reperfilados: number;
  cambios: number;
  desgloseEstado: DesgloseEstadoApi;
}

export interface EventoPronosticoApi {
  tipo: TipoEventoPronostico;
  fechaEstimada: string;
  pendiente: boolean;
  fechaUltimaMedicion: string;
  diasHastaEvento: number;
  trenNumero: number;
  posiciones: PosicionDisco[];
}

interface EventoPronosticoCalculado {
  tipo: TipoEventoPronostico;
  fechaEstimada: Date;
  pendiente: boolean;
  fechaUltimaMedicion: Date;
  trenNumero: number;
  posiciones: PosicionDisco[];
}

interface DiscoEnScope {
  discId: string;
  trenNumero: number;
  ordenFisico: number;
}

// Orquesta las 3 consultas de la Proyección de Reperfilado y Cambio: el
// listado paginado por disco (/discos), la tasa promedio de desgaste por
// tipo de coche (/promedio-por-vagon) y el pronóstico agregado de 12 meses
// (/pronostico-12-meses). ProyeccionCalculatorService resuelve la proyección
// de UN disco a la vez; acá se decide QUÉ discos entran en cada consulta,
// en qué orden, y cómo se agrega el resultado.
@Injectable()
export class ProyeccionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rate: ProyeccionRateService,
    private readonly calculator: ProyeccionCalculatorService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
    private readonly umbralesProyeccion: ProyeccionUmbralesService,
  ) {}

  // Umbrales de BrakeDiscRules + Proyección, resueltos UNA sola vez por
  // request — mismo criterio que ProyeccionRateService.calcularTasasPorTipoCoche:
  // son globales (no dependen del disco), así que releerlos por cada disco del
  // scope (hasta ~1900 en flota completa) solo multiplica queries a
  // system_params sin cambiar el resultado.
  private async resolverUmbralesProyeccion(): Promise<UmbralesProyectarDisco> {
    const [umbrales, configuracionProyeccion] = await Promise.all([
      this.brakeDiscRules.obtenerUmbrales(),
      this.umbralesProyeccion.obtener(),
    ]);
    return { umbrales, configuracionProyeccion };
  }

  // Ordenados con el mismo criterio jerárquico que scan-records/wear-rate
  // (tren -> coche -> bogie -> eje -> rueda, ver common/orden-fisico.ts).
  //
  // Dos caminos, mismo criterio que WearRateService.buscarPares con
  // accionRecomendada: sin filtros derivados (estado/fechas estimadas/H-T-Rd
  // — ninguno es una columna, todos salen de proyectar cada disco) la
  // proyección solo se calcula para los discos de la página pedida. Con
  // cualquiera de esos filtros activo, hace falta proyectar TODO el scope
  // primero (no hay forma de saber qué matchea sin proyectar), filtrar, y
  // recién ahí paginar en memoria.
  async listarDiscos(
    q: ProyeccionDiscosQueryDto,
  ): Promise<ProyeccionDiscosResult> {
    const discosEnScope = await this.resolverDiscosEnScope({
      tren: q.tren,
      lado: q.lado,
      ejeMin: q.ejeMin,
      ejeMax: q.ejeMax,
      ruedaMin: q.ruedaMin,
      ruedaMax: q.ruedaMax,
    });

    if (this.tieneFiltrosDerivados(q)) {
      return this.listarDiscosConFiltros(discosEnScope, q);
    }

    const total = discosEnScope.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const inicio = (q.page - 1) * q.pageSize;
    const pagina = discosEnScope.slice(inicio, inicio + q.pageSize);

    const [tasasPorTipoCoche, umbralesPrecalculados] = await Promise.all([
      this.rate.calcularTasasPorTipoCoche(),
      this.resolverUmbralesProyeccion(),
    ]);
    const proyecciones = await Promise.all(
      pagina.map((d) =>
        this.calculator.proyectarDisco(
          d.discId,
          tasasPorTipoCoche,
          umbralesPrecalculados,
        ),
      ),
    );

    // null = disco sin ninguna medición confirmada todavía (ver
    // ProyeccionCalculatorService.proyectarDisco) — no hay nada que proyectar
    // ni que mostrar para él, se omite de esta página. `total`/`totalPages`
    // ya se calcularon sobre el universo completo del scope, así que en el
    // caso (raro) de que la página tenga discos sin medición, esa página
    // puede devolver menos de pageSize filas — no se compensa trayendo filas
    // de la página siguiente, mismo criterio simple que el resto del sistema
    // aplica a huecos post-filtro.
    const trenPorDiscId = new Map(pagina.map((d) => [d.discId, d.trenNumero]));
    const proyectadas = proyecciones.filter(
      (p): p is ProyeccionDisco => p !== null,
    );
    const overrides = await this.resolverOverridesPorEje(
      proyectadas,
      tasasPorTipoCoche,
      umbralesPrecalculados,
    );
    const rows = proyectadas.map((p) =>
      this.aDiscoApi(p, trenPorDiscId.get(p.discId)!, overrides.get(p.discId)),
    );

    return {
      rows,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      totalPaginas: totalPages,
    };
  }

  private async listarDiscosConFiltros(
    discosEnScope: DiscoEnScope[],
    q: ProyeccionDiscosQueryDto,
  ): Promise<ProyeccionDiscosResult> {
    const [tasasPorTipoCoche, umbralesPrecalculados] = await Promise.all([
      this.rate.calcularTasasPorTipoCoche(),
      this.resolverUmbralesProyeccion(),
    ]);
    const proyecciones = await Promise.all(
      discosEnScope.map((d) =>
        this.calculator.proyectarDisco(
          d.discId,
          tasasPorTipoCoche,
          umbralesPrecalculados,
        ),
      ),
    );

    const trenPorDiscId = new Map(
      discosEnScope.map((d) => [d.discId, d.trenNumero]),
    );
    const filtradas = proyecciones
      .filter((p): p is ProyeccionDisco => p !== null)
      .filter((p) => this.cumpleFiltros(p, q));

    const total = filtradas.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const inicio = (q.page - 1) * q.pageSize;
    const pagina = filtradas.slice(inicio, inicio + q.pageSize);
    // Overrides resueltos SOLO sobre la página mostrada (no sobre `filtradas`
    // completo) — el hermano de un disco fuera de esta página se busca ad-hoc
    // si hace falta (ver resolverHermanoAdHoc), así que no hace falta más.
    const overrides = await this.resolverOverridesPorEje(
      pagina,
      tasasPorTipoCoche,
      umbralesPrecalculados,
    );

    return {
      rows: pagina.map((p) =>
        this.aDiscoApi(
          p,
          trenPorDiscId.get(p.discId)!,
          overrides.get(p.discId),
        ),
      ),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages,
      totalPaginas: totalPages,
    };
  }

  private tieneFiltrosDerivados(q: ProyeccionDiscosQueryDto): boolean {
    return !!(
      q.estado?.length ||
      q.siguienteReperfiladoDesde ||
      q.siguienteReperfiladoHasta ||
      q.siguienteCambioDesde ||
      q.siguienteCambioHasta ||
      q.hMin !== undefined ||
      q.hMax !== undefined ||
      q.tMin !== undefined ||
      q.tMax !== undefined ||
      q.rdMin !== undefined ||
      q.rdMax !== undefined ||
      q.motivo?.length ||
      q.responsable?.length
    );
  }

  // Cada filtro activo es UNA condición combinable — mismo criterio que
  // construirWhereScanRecord/construirWhereWearRate (AND exige todas, OR
  // cualquiera), solo que acá se evalúan en memoria sobre el disco ya
  // proyectado en vez de armar un WHERE de Prisma (ninguno de estos campos
  // es una columna real).
  private cumpleFiltros(
    p: ProyeccionDisco,
    q: ProyeccionDiscosQueryDto,
  ): boolean {
    const condiciones: boolean[] = [];

    if (q.estado?.length) condiciones.push(q.estado.includes(p.estado));

    if (q.siguienteReperfiladoDesde || q.siguienteReperfiladoHasta) {
      condiciones.push(
        this.enRangoFecha(
          p.ciclosReperfilado[0]?.fechaEstimada ?? null,
          q.siguienteReperfiladoDesde,
          q.siguienteReperfiladoHasta,
        ),
      );
    }
    if (q.siguienteCambioDesde || q.siguienteCambioHasta) {
      condiciones.push(
        this.enRangoFecha(
          p.cicloCambio?.fechaEstimada ?? null,
          q.siguienteCambioDesde,
          q.siguienteCambioHasta,
        ),
      );
    }
    if (q.hMin !== undefined || q.hMax !== undefined) {
      condiciones.push(this.enRangoNumero(p.h, q.hMin, q.hMax));
    }
    if (q.tMin !== undefined || q.tMax !== undefined) {
      condiciones.push(this.enRangoNumero(p.t, q.tMin, q.tMax));
    }
    if (q.rdMin !== undefined || q.rdMax !== undefined) {
      condiciones.push(this.enRangoNumero(p.rd, q.rdMin, q.rdMax));
    }
    // motivo/responsable de la ÚLTIMA MEDICIÓN (la que ancla esta proyección
    // — ver ProyeccionDisco.motivoUltimaMedicion), no de cualquier medición
    // histórica del disco. Insensible a mayúsculas, mismo criterio que
    // construirWhereScanRecord (motivo/responsable de Mediciones confirmadas).
    if (q.motivo?.length) {
      condiciones.push(
        this.coincideInsensible(p.motivoUltimaMedicion, q.motivo),
      );
    }
    if (q.responsable?.length) {
      condiciones.push(
        this.coincideInsensible(p.responsableUltimaMedicion, q.responsable),
      );
    }

    if (condiciones.length === 0) return true;
    return q.modoCombinacion === 'OR'
      ? condiciones.some(Boolean)
      : condiciones.every(Boolean);
  }

  // Comparación por fecha ISO (YYYY-MM-DD, ambos extremos inclusive) en vez
  // de por instante exacto: fechaEstimada casi nunca cae en medianoche (sale
  // de sumar una cantidad fraccionaria de meses — ver
  // proyeccion-calculator.engine.ts), y el date picker del frontend solo
  // conoce el día, no la hora.
  private enRangoFecha(
    fecha: Date | null,
    desde?: string,
    hasta?: string,
  ): boolean {
    if (fecha === null) return false;
    const iso = fecha.toISOString().slice(0, 10);
    if (desde && iso < desde) return false;
    if (hasta && iso > hasta) return false;
    return true;
  }

  private enRangoNumero(valor: number, min?: number, max?: number): boolean {
    if (min !== undefined && valor < min) return false;
    if (max !== undefined && valor > max) return false;
    return true;
  }

  private coincideInsensible(valor: string, lista: string[]): boolean {
    const objetivo = valor.toLowerCase();
    return lista.some((v) => v.toLowerCase() === objetivo);
  }

  // Los 6 tipos de coche Alstom (MA1/MB1/MB3/REM/MB2/MA2, ya en el orden
  // físico real — ver ORDEN_COCHE_FLOTA) con su tasa promedio de desgaste
  // fleet-wide, o null si no hay pares suficientes en el rango de km
  // configurado (ver ProyeccionRateService). Ansaldo (M20/M21/M22) queda
  // fuera a propósito — ver comentario de resolverDiscosEnScope.
  async obtenerPromedioPorVagon(): Promise<PromedioPorVagonApi[]> {
    const tasas = await this.rate.calcularTasasPorTipoCoche();
    return ORDEN_COCHE_FLOTA.map((tipoCoche) => ({
      tipoCoche,
      tasaPromedio: tasas[tipoCoche],
    }));
  }

  // Agrega, mes a mes (rango calendario desde hoy, ver q.meses — 12/24/36/
  // 48/60, ProyeccionPronosticoQueryDto), cuántos discos del scope tienen un
  // reperfilado o un cambio proyectado cayendo en ese mes, y el desglose de
  // estado AMPLIADO proyectado de la flota en ese punto (con el H/Rd
  // interpolados a esa fecha, no el estado actual). Agregación siempre
  // MENSUAL sin importar el rango elegido — mismo shape de response, solo
  // cambia la cantidad de filas. A diferencia de /discos, acá SÍ hace falta
  // proyectar TODOS los discos del scope (no solo una página): cada uno
  // aporta a la suma de todos los meses.
  async obtenerPronostico(
    q: ProyeccionPronosticoQueryDto,
  ): Promise<PronosticoMesApi[]> {
    const discosEnScope = await this.resolverDiscosEnScope({ tren: q.tren });
    const [tasasPorTipoCoche, umbralesPrecalculados] = await Promise.all([
      this.rate.calcularTasasPorTipoCoche(),
      this.resolverUmbralesProyeccion(),
    ]);
    const evaluador = new BrakeDiscRulesEngine(umbralesPrecalculados.umbrales);

    const proyecciones = (
      await Promise.all(
        discosEnScope.map((d) =>
          this.calculator.proyectarDisco(
            d.discId,
            tasasPorTipoCoche,
            umbralesPrecalculados,
          ),
        ),
      )
    ).filter((p): p is ProyeccionDisco => p !== null);
    const trenPorDiscId = new Map(
      discosEnScope.map((d) => [d.discId, d.trenNumero]),
    );
    const eventos = await this.resolverEventosPronostico(
      proyecciones,
      trenPorDiscId,
      tasasPorTipoCoche,
      umbralesPrecalculados,
    );

    const hoy = new Date();
    const meses = generarMesesForecast(hoy, q.meses);
    return meses.map((mes) =>
      this.agregarMes(mes, proyecciones, eventos, evaluador, hoy),
    );
  }

  // Detalle bajo demanda de una barra/fila del pronóstico. Usa exactamente
  // los ciclos calculados para la agregación mensual; solo cambia que acá se
  // conservan los eventos individuales y su posición física.
  async obtenerDetallePronostico(
    q: ProyeccionPronosticoDetalleQueryDto,
  ): Promise<EventoPronosticoApi[]> {
    const discosEnScope = await this.resolverDiscosEnScope({ tren: q.tren });
    const [tasasPorTipoCoche, umbralesPrecalculados] = await Promise.all([
      this.rate.calcularTasasPorTipoCoche(),
      this.resolverUmbralesProyeccion(),
    ]);
    const proyecciones = (
      await Promise.all(
        discosEnScope.map((d) =>
          this.calculator.proyectarDisco(
            d.discId,
            tasasPorTipoCoche,
            umbralesPrecalculados,
          ),
        ),
      )
    ).filter((p): p is ProyeccionDisco => p !== null);
    const trenPorDiscId = new Map(
      discosEnScope.map((d) => [d.discId, d.trenNumero]),
    );

    const eventos = await this.resolverEventosPronostico(
      proyecciones,
      trenPorDiscId,
      tasasPorTipoCoche,
      umbralesPrecalculados,
    );

    return eventos
      .filter(
        (evento) =>
          (q.tipo === undefined || evento.tipo === q.tipo) &&
          this.fechaCaeEnPeriodo(evento.fechaEstimada, q.periodo),
      )
      .map((evento) => ({
        ...evento,
        fechaEstimada: evento.fechaEstimada.toISOString().slice(0, 10),
        fechaUltimaMedicion: evento.fechaUltimaMedicion
          .toISOString()
          .slice(0, 10),
        diasHastaEvento: this.diasEntreFechas(
          evento.fechaUltimaMedicion,
          evento.fechaEstimada,
        ),
      }))
      .sort(
        (a, b) =>
          a.fechaEstimada.localeCompare(b.fechaEstimada) ||
          a.tipo.localeCompare(b.tipo) ||
          a.trenNumero - b.trenNumero ||
          a.posiciones[0].numeroCoche - b.posiciones[0].numeroCoche ||
          a.posiciones[0].bogieCodigo.localeCompare(
            b.posiciones[0].bogieCodigo,
          ) ||
          a.posiciones[0].ejeNumero - b.posiciones[0].ejeNumero,
      );
  }

  private fechaCaeEnPeriodo(fecha: Date, periodo: string): boolean {
    const iso = fecha.toISOString().slice(0, periodo.length);
    return iso === periodo;
  }

  private diasEntreFechas(desde: Date, hasta: Date): number {
    const dias = (hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000);
    return Math.trunc(dias * 10) / 10;
  }

  // Una intervención cuenta por eje físico, no por lado. El primer
  // reperfilado y el cambio se sincronizan a la fecha más próxima, igual que
  // la tabla principal; los ciclos posteriores permanecen propios porque el
  // modelo solo define ese override para el primer ciclo.
  private async resolverEventosPronostico(
    proyecciones: ProyeccionDisco[],
    trenPorDiscId: Map<string, number>,
    tasasPorTipoCoche: Partial<Record<TipoCoche, number | null>>,
    umbralesPrecalculados: UmbralesProyectarDisco,
  ): Promise<EventoPronosticoCalculado[]> {
    const overrides = await this.resolverOverridesPorEje(
      proyecciones,
      tasasPorTipoCoche,
      umbralesPrecalculados,
    );
    const eventos = new Map<string, EventoPronosticoCalculado>();
    const hoy = new Date();

    const agregar = (
      clave: string,
      tipo: TipoEventoPronostico,
      fechaEstimada: Date,
      pendiente: boolean,
      disco: ProyeccionDisco,
    ) => {
      const existente = eventos.get(clave);
      if (existente) {
        if (!existente.posiciones.some((p) => p.lado === disco.posicion.lado)) {
          existente.posiciones.push(disco.posicion);
        }
        if (disco.fechaUltimaMedicion > existente.fechaUltimaMedicion) {
          existente.fechaUltimaMedicion = disco.fechaUltimaMedicion;
        }
        if (!existente.pendiente && fechaEstimada < existente.fechaEstimada) {
          existente.fechaEstimada = fechaEstimada;
          existente.pendiente = pendiente;
        } else if (pendiente) {
          existente.pendiente = true;
        }
        return;
      }
      eventos.set(clave, {
        tipo,
        fechaEstimada,
        pendiente,
        fechaUltimaMedicion: disco.fechaUltimaMedicion,
        trenNumero: trenPorDiscId.get(disco.discId)!,
        posiciones: [disco.posicion],
      });
    };

    for (const disco of proyecciones) {
      const override = overrides.get(disco.discId);
      const primerReperfilado =
        override?.reperfilado?.cicloMasProximo ?? disco.ciclosReperfilado[0];
      const reperfiladoPendiente = this.esPendiente(disco, 'REPERFILADO');
      if (reperfiladoPendiente) {
        agregar(
          `${this.claveEje(disco.posicion)}|REPERFILADO|1`,
          'REPERFILADO',
          hoy,
          true,
          disco,
        );
      } else if (primerReperfilado) {
        agregar(
          `${this.claveEje(disco.posicion)}|REPERFILADO|1`,
          'REPERFILADO',
          primerReperfilado.fechaEstimada,
          false,
          disco,
        );
      }
      for (const ciclo of disco.ciclosReperfilado.slice(1)) {
        agregar(
          `${disco.discId}|REPERFILADO|${ciclo.numero}`,
          'REPERFILADO',
          ciclo.fechaEstimada,
          false,
          disco,
        );
      }

      const cambio = override?.cambio?.cicloMasProximo ?? disco.cicloCambio;
      const cambioPendiente = this.esPendiente(disco, 'CAMBIO');
      if (cambioPendiente) {
        agregar(
          `${this.claveEje(disco.posicion)}|CAMBIO`,
          'CAMBIO',
          hoy,
          true,
          disco,
        );
      } else if (cambio) {
        agregar(
          `${this.claveEje(disco.posicion)}|CAMBIO`,
          'CAMBIO',
          cambio.fechaEstimada,
          false,
          disco,
        );
      }
    }

    return [...eventos.values()];
  }

  private esPendiente(
    disco: ProyeccionDisco,
    tipo: TipoEventoPronostico,
  ): boolean {
    return tipo === 'REPERFILADO'
      ? disco.estado === 'REPERFILADO'
      : disco.estado === 'CAMBIO' || disco.estado === 'CRITICO';
  }

  private agregarMes(
    mes: MesForecast,
    discos: ProyeccionDisco[],
    eventos: EventoPronosticoCalculado[],
    evaluador: BrakeDiscRulesEngine,
    hoy: Date,
  ): PronosticoMesApi {
    const reperfilados = eventos.filter(
      (evento) =>
        evento.tipo === 'REPERFILADO' &&
        fechaCaeEnMes(evento.fechaEstimada, mes),
    ).length;
    const cambios = eventos.filter(
      (evento) =>
        evento.tipo === 'CAMBIO' && fechaCaeEnMes(evento.fechaEstimada, mes),
    ).length;
    const conteo: Record<EstadoDiscoAmpliado, number> = {
      OK: 0,
      SEGUIMIENTO: 0,
      CAMBIO: 0,
      CRITICO: 0,
      REPERFILADO: 0,
    };

    for (const disco of discos) {
      conteo[this.estadoProyectadoEnMes(disco, mes, evaluador, hoy)] += 1;
    }

    return {
      mes: mes.mes,
      reperfilados,
      cambios,
      desgloseEstado: {
        ok: conteo.OK,
        seguimiento: conteo.SEGUIMIENTO,
        cambio: conteo.CAMBIO,
        critico: conteo.CRITICO,
        reperfilado: conteo.REPERFILADO,
      },
    };
  }

  // Un disco sin tasa de desgaste resuelta (proyectable=false) no tiene cómo
  // interpolarse hacia adelante: se cuenta con su estado ACTUAL en los 12
  // meses del pronóstico (mejor eso que excluirlo del desglose por completo
  // — sigue siendo parte real de la flota).
  private estadoProyectadoEnMes(
    disco: ProyeccionDisco,
    mes: MesForecast,
    evaluador: BrakeDiscRulesEngine,
    hoy: Date,
  ): EstadoDiscoAmpliado {
    if (!disco.proyectable || disco.tasaMensual === null) return disco.estado;

    // proyectarCiclos asume que el reperfilado ocurre INSTANTÁNEAMENTE apenas
    // H cruza el umbral (sin tiempo de permanencia) — para un disco que YA
    // está sobre el umbral en su última medición real, esto colapsa su
    // primer ciclo al día mismo de esa medición, así que interpolarEnFecha
    // jamás devuelve REPERFILADO, ni siquiera para el mes en curso: el disco
    // "ya fue reperfilado" en el modelo antes de que el pronóstico arranque.
    // En el mes en curso (el que contiene "hoy") sí hay un dato real y no
    // solo interpolado: si el disco está en REPERFILADO ahora mismo (según
    // su última medición), todavía no fue atendido en la realidad, así que
    // se prioriza ese estado real por sobre el interpolado. Los meses
    // futuros siguen sin poder representar el tiempo de permanencia en
    // REPERFILADO — limitación del motor de proyección, no de este parche.
    if (disco.estado === 'REPERFILADO' && fechaCaeEnMes(hoy, mes)) {
      return 'REPERFILADO';
    }

    const punto = interpolarEnFecha(
      { h: disco.h, rd: disco.rd, fecha: disco.fechaUltimaMedicion },
      disco.ciclosReperfilado,
      disco.tasaMensual,
      mes.fechaReferencia,
    );
    return evaluador.clasificarEstadoConReperfilado(punto.rd, punto.h);
  }

  // Discos ACTIVOS del scope (tren opcional = toda la flota), con su tren y
  // orden físico ya resueltos — mismo criterio jerárquico (tren -> coche ->
  // bogie -> eje -> rueda) que ScanRecord.ordenFisico/WearRatePair.ordenFisico,
  // pero calculado acá porque BrakeDisc no tiene esa columna precomputada
  // (es una tabla de identidad física, no de mediciones).
  //
  // eje/rueda/lado SÍ son columnas reales de BrakeDisc (a diferencia de
  // motivo/responsable, que son filtros derivados — ver cumpleFiltros): se
  // aplican acá, en el WHERE, reutilizando empujarRango (mismo helper
  // genérico que scan-record-query.ts) — reduce el scope ANTES de proyectar
  // ningún disco, más barato que filtrar después.
  private async resolverDiscosEnScope(q: {
    tren?: number;
    lado?: LadoDisco[];
    ejeMin?: number;
    ejeMax?: number;
    ruedaMin?: number;
    ruedaMax?: number;
  }): Promise<DiscoEnScope[]> {
    const condicionesRango: Prisma.BrakeDiscWhereInput[] = [];
    empujarRango(condicionesRango, 'ejeNumero', q.ejeMin, q.ejeMax);
    empujarRango(condicionesRango, 'ruedaNumero', q.ruedaMin, q.ruedaMax);

    const where: Prisma.BrakeDiscWhereInput = {
      activo: true,
      // stage: 'en_servicio' — la proyección extrapola desgaste futuro, que
      // solo tiene sentido para piezas montadas y acumulando uso.
      stage: 'en_servicio',
      // Ansaldo (y su pseudo-tren Reserva) queda fuera de Proyección: asume
      // 2 discos por eje (ver claveEje/resolverOverridesPorEje más abajo),
      // que emparejaría mal los 4 discos por eje de Ansaldo. Generalizar
      // este módulo queda para un trabajo futuro dedicado.
      wagonUnit: {
        tren: {
          modelo: 'alstom_metropolis9000',
          ...(q.tren !== undefined ? { numero: q.tren } : {}),
        },
      },
      ...(q.lado?.length ? { lado: { in: q.lado } } : {}),
      ...(condicionesRango.length ? { AND: condicionesRango } : {}),
    };
    const discos = await this.prisma.brakeDisc.findMany({
      where,
      include: { wagonUnit: { include: { tren: true } } },
    });

    // wagonUnit/bogieCodigo/ejeNumero no-null garantizados por el where
    // (stage: 'en_servicio') — Prisma no lo refleja en el tipo generado.
    return discos
      .map((d) => ({
        discId: d.id,
        trenNumero: d.wagonUnit!.tren.numero,
        ordenFisico: calcularOrdenFisico({
          tipoCoche: d.wagonUnit!.tipoCoche,
          bogieCodigo: d.bogieCodigo!,
          ejeNumero: d.ejeNumero!,
          ruedaNumero: d.ruedaNumero,
        }),
      }))
      .sort(
        (a, b) =>
          a.trenNumero - b.trenNumero ||
          a.ordenFisico - b.ordenFisico ||
          a.discId.localeCompare(b.discId),
      );
  }

  // clave = numeroCoche+bogieCodigo+ejeNumero (numeroCoche ya es único fleet-
  // wide, no hace falta trenNumero): identifica el EJE físico, que tiene
  // exactamente 2 discos (izquierdo/derecho) — la base de la Parte 3.
  private claveEje(pos: PosicionDisco): string {
    return `${pos.numeroCoche}|${pos.bogieCodigo}|${pos.ejeNumero}`;
  }

  // Cuando el "siguiente" cicloReperfilado (numero=1) o el cicloCambio de un
  // disco es más TARDÍO que el de su hermano de eje, el hermano manda: en la
  // práctica los 2 discos de un eje se atienden juntos, así que se antepone
  // acá el ciclo del hermano completo (no solo la fecha, ver
  // CicloReperfiladoApi/CicloCambioApi) y se guarda la propia fecha
  // independiente para el tooltip del frontend. Nunca toca
  // ciclosReperfilado[1..] (solo el primero) ni compara cuando alguno de los
  // 2 lados no tiene ese ciclo (nada que anteponer sin un valor del otro
  // lado) — reperfilado y cambio se comparan de forma INDEPENDIENTE entre sí.
  private async resolverOverridesPorEje(
    proyecciones: ProyeccionDisco[],
    tasasPorTipoCoche: Partial<Record<TipoCoche, number | null>>,
    umbralesPrecalculados: UmbralesProyectarDisco,
  ): Promise<Map<string, OverrideSiguiente>> {
    const overrides = new Map<string, OverrideSiguiente>();
    const pendientePorEje = new Map<string, ProyeccionDisco>();

    for (const p of proyecciones) {
      const clave = this.claveEje(p.posicion);
      const pendiente = pendientePorEje.get(clave);
      if (pendiente) {
        this.registrarOverrides(pendiente, p, overrides);
        pendientePorEje.delete(clave);
      } else {
        pendientePorEje.set(clave, p);
      }
    }

    // Discos cuyo hermano no estaba en este mismo batch (puede estar en otra
    // página, o no calificar para el scope/filtros actuales) — se resuelve
    // aparte, sin que eso fuerce al hermano a aparecer en la respuesta.
    const cacheHermano = new Map<string, ProyeccionDisco | null>();
    for (const p of pendientePorEje.values()) {
      const hermano = await this.resolverHermanoAdHoc(
        p,
        tasasPorTipoCoche,
        umbralesPrecalculados,
        cacheHermano,
      );
      if (hermano) this.registrarOverrides(p, hermano, overrides);
    }

    return overrides;
  }

  private registrarOverrides(
    a: ProyeccionDisco,
    b: ProyeccionDisco,
    overrides: Map<string, OverrideSiguiente>,
  ): void {
    const reperfilado = this.compararCiclo(
      a,
      b,
      (p) => p.ciclosReperfilado[0] ?? null,
    );
    if (reperfilado) {
      const { discIdOtro, ...resto } = reperfilado;
      const entrada = overrides.get(discIdOtro) ?? {};
      entrada.reperfilado = resto;
      overrides.set(discIdOtro, entrada);
    }

    const cambio = this.compararCiclo(a, b, (p) => p.cicloCambio);
    if (cambio) {
      const { discIdOtro, ...resto } = cambio;
      const entrada = overrides.get(discIdOtro) ?? {};
      entrada.cambio = resto;
      overrides.set(discIdOtro, entrada);
    }
  }

  // Compara el ciclo de `a` y `b` (obtenido con `obtener`, INDEPENDIENTE para
  // reperfilado y para cambio): si ambos existen y difieren, devuelve cuál es
  // el más próximo y para cuál de los 2 discos (discIdOtro) queda antepuesto,
  // junto con SU propia fecha independiente. null si no hay nada que
  // comparar (falta alguno de los 2, o coinciden exactamente).
  private compararCiclo<T extends { fechaEstimada: Date }>(
    a: ProyeccionDisco,
    b: ProyeccionDisco,
    obtener: (p: ProyeccionDisco) => T | null,
  ): { discIdOtro: string; cicloMasProximo: T; fechaPropia: Date } | null {
    const ca = obtener(a);
    const cb = obtener(b);
    if (!ca || !cb) return null;
    if (ca.fechaEstimada.getTime() === cb.fechaEstimada.getTime()) return null;

    const aEsMasProximo = ca.fechaEstimada < cb.fechaEstimada;
    return {
      discIdOtro: aEsMasProximo ? b.discId : a.discId,
      cicloMasProximo: aEsMasProximo ? ca : cb,
      fechaPropia: aEsMasProximo ? cb.fechaEstimada : ca.fechaEstimada,
    };
  }

  // Proyecta el disco hermano (mismo numeroCoche+bogieCodigo+ejeNumero, lado
  // opuesto) SIN importar si está en el scope/filtros actuales — necesario
  // porque la comparación de la Parte 3 debe ser correcta sin importar en qué
  // página cae cada lado. `cache` evita recalcular si 2 discos del batch ya
  // comparten el mismo hermano ad-hoc (no debería pasar en la práctica, pero
  // es gratis evitarlo).
  private async resolverHermanoAdHoc(
    p: ProyeccionDisco,
    tasasPorTipoCoche: Partial<Record<TipoCoche, number | null>>,
    umbralesPrecalculados: UmbralesProyectarDisco,
    cache: Map<string, ProyeccionDisco | null>,
  ): Promise<ProyeccionDisco | null> {
    const clave = this.claveEje(p.posicion);
    if (cache.has(clave)) return cache.get(clave) ?? null;

    const ladoOpuesto: LadoDisco =
      p.posicion.lado === 'izquierdo' ? 'derecho' : 'izquierdo';
    const hermanoDisco = await this.prisma.brakeDisc.findFirst({
      where: {
        bogieCodigo: p.posicion.bogieCodigo,
        ejeNumero: p.posicion.ejeNumero,
        lado: ladoOpuesto,
        wagonUnit: { numeroCoche: p.posicion.numeroCoche },
      },
      select: { id: true },
    });
    const resultado = hermanoDisco
      ? await this.calculator.proyectarDisco(
          hermanoDisco.id,
          tasasPorTipoCoche,
          umbralesPrecalculados,
        )
      : null;
    cache.set(clave, resultado);
    return resultado;
  }

  private aDiscoApi(
    p: ProyeccionDisco,
    trenNumero: number,
    override?: OverrideSiguiente,
  ): ProyeccionDiscoApi {
    return {
      discId: p.discId,
      trenNumero,
      posicion: p.posicion,
      fechaUltimaMedicion: p.fechaUltimaMedicion.toISOString().slice(0, 10),
      h: p.h,
      t: p.t,
      rd: p.rd,
      estado: p.estado,
      proyectable: p.proyectable,
      motivo: p.motivo,
      ciclosReperfilado: p.ciclosReperfilado.map((c, i) =>
        i === 0 && override?.reperfilado
          ? this.cicloReperfiladoApi(
              override.reperfilado.cicloMasProximo,
              override.reperfilado.fechaPropia,
            )
          : this.cicloReperfiladoApi(c, null),
      ),
      cicloCambio: override?.cambio
        ? this.cicloCambioApi(
            override.cambio.cicloMasProximo,
            override.cambio.fechaPropia,
          )
        : p.cicloCambio
          ? this.cicloCambioApi(p.cicloCambio, null)
          : null,
    };
  }

  private cicloReperfiladoApi(
    c: CicloReperfilado,
    fechaPropia: Date | null,
  ): CicloReperfiladoApi {
    return {
      numero: c.numero,
      mesesHastaFecha: c.mesesHastaFecha,
      fechaEstimada: c.fechaEstimada.toISOString().slice(0, 10),
      hEnEseMomento: c.hEnEseMomento,
      tEnEseMomento: c.tEnEseMomento,
      rdAntes: c.rdAntes,
      rdDespues: c.rdDespues,
      fechaPropiaSiFueraIndependiente: fechaPropia
        ? fechaPropia.toISOString().slice(0, 10)
        : null,
    };
  }

  private cicloCambioApi(
    c: CicloCambio,
    fechaPropia: Date | null,
  ): CicloCambioApi {
    return {
      mesesHastaFecha: c.mesesHastaFecha,
      fechaEstimada: c.fechaEstimada.toISOString().slice(0, 10),
      fechaPropiaSiFueraIndependiente: fechaPropia
        ? fechaPropia.toISOString().slice(0, 10)
        : null,
    };
  }
}

interface OverrideSiguiente {
  reperfilado?: { cicloMasProximo: CicloReperfilado; fechaPropia: Date };
  cambio?: { cicloMasProximo: CicloCambio; fechaPropia: Date };
}
