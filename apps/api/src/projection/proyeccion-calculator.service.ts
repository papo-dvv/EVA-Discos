import { Injectable, NotFoundException } from '@nestjs/common';
import type { LadoDisco, TipoCoche } from '../../generated/prisma';
import {
  BrakeDiscRulesEngine,
  type EstadoDiscoAmpliado,
} from '../brake-disc-rules/brake-disc-rules.engine';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ORDEN_MAS_RECIENTE } from '../scan-records/accion-recomendada.query';
import {
  proyectarCiclos,
  type CicloCambio,
  type CicloReperfilado,
} from './proyeccion-calculator.engine';
import { ProyeccionRateService } from './proyeccion-rate.service';

export interface PosicionDisco {
  tipoCoche: TipoCoche;
  numeroCoche: number;
  bogieCodigo: string;
  ejeNumero: number;
  lado: LadoDisco;
}

// Representación INTERNA (fechas como Date, no string) — la conversión a
// forma de API (ISO) vive en ProyeccionService.aDiscoApi, igual criterio que
// TraceabilityStatsService/PuntoClasificado (fecha: Date) vs. PuntoSerieApi
// (fecha: string) en traceability.service.ts. tasaMensual viaja acá para que
// ProyeccionService la reutilice en /pronostico-12-meses (interpolarEnFecha)
// sin tener que resolverla de nuevo.
export interface ProyeccionDisco {
  discId: string;
  posicion: PosicionDisco;
  fechaUltimaMedicion: Date;
  h: number;
  t: number;
  rd: number;
  estado: EstadoDiscoAmpliado;
  tasaMensual: number | null;
  proyectable: boolean;
  // null cuando proyectable=true; siempre presente (texto claro) cuando
  // proyectable=false — nunca ambos null/vacío a la vez.
  motivo: string | null;
  // Motivo/responsable de la ÚLTIMA MEDICIÓN (la que ancla la proyección) —
  // distinto de `motivo` de arriba (motivo de NO-proyectabilidad). Usados
  // como filtros derivados por ProyeccionService (ver cumpleFiltros): la
  // proyección siempre ancla en la medición MÁS RECIENTE del disco, así que
  // filtrar por estos campos es filtrar por "el motivo/responsable de la
  // medición que dio origen a esta proyección", no por cualquier medición
  // histórica del disco.
  motivoUltimaMedicion: string;
  responsableUltimaMedicion: string;
  ciclosReperfilado: CicloReperfilado[];
  cicloCambio: CicloCambio | null;
  truncado: boolean;
}

// Fachada inyectable de la Proyección de Reperfilado y Cambio para UN disco:
// resuelve su última medición confirmada, la tasa promedio de desgaste de su
// tipo de coche y los umbrales vigentes del motor de reglas, y delega el
// cálculo recursivo en proyectarCiclos (motor puro, ver
// proyeccion-calculator.engine.ts).
@Injectable()
export class ProyeccionCalculatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rate: ProyeccionRateService,
    private readonly brakeDiscRules: BrakeDiscRulesService,
  ) {}

  // `tasasPorTipoCoche` es opcional: sin él, resuelve la tasa del tipo de
  // coche de ESTE disco con una consulta propia (uso puntual / tests). Quien
  // proyecta MUCHOS discos a la vez (ProyeccionService, /discos y
  // /pronostico-12-meses) debe resolver los 6 valores UNA sola vez (ver
  // ProyeccionRateService.calcularTasasPorTipoCoche) y pasarlos acá, para no
  // repetir la misma consulta de wear_rate_pairs por cada disco de la flota.
  //
  // Devuelve null solo si el disco no tiene NINGUNA medición confirmada
  // (nada que proyectar todavía) — distinto del caso "sin tasa de desgaste
  // para su tipo de coche", que sí devuelve un resultado con
  // proyectable=false y un motivo claro (ver enunciado, punto 3.e).
  async proyectarDisco(
    discId: string,
    tasasPorTipoCoche?: Partial<Record<TipoCoche, number | null>>,
  ): Promise<ProyeccionDisco | null> {
    const disco = await this.prisma.brakeDisc.findUnique({
      where: { id: discId },
      include: { wagonUnit: true },
    });
    if (!disco) {
      throw new NotFoundException('El disco no existe.');
    }

    const ultimaMedicion = await this.prisma.scanRecord.findFirst({
      where: { discId },
      orderBy: ORDEN_MAS_RECIENTE,
      select: {
        fecha: true,
        hValue: true,
        tValue: true,
        rdValue: true,
        motivo: true,
        responsableNombre: true,
      },
    });
    if (!ultimaMedicion) return null;

    const posicion: PosicionDisco = {
      tipoCoche: disco.wagonUnit.tipoCoche,
      numeroCoche: disco.wagonUnit.numeroCoche,
      bogieCodigo: disco.bogieCodigo,
      ejeNumero: disco.ejeNumero,
      lado: disco.lado,
    };

    const h = Number(ultimaMedicion.hValue);
    const t = Number(ultimaMedicion.tValue);
    const rd = ultimaMedicion.rdValue;

    const [umbrales, tasaMensual] = await Promise.all([
      this.brakeDiscRules.obtenerUmbrales(),
      tasasPorTipoCoche
        ? Promise.resolve(tasasPorTipoCoche[posicion.tipoCoche] ?? null)
        : this.rate.calcularTasaPromedioPorTipoCoche(posicion.tipoCoche),
    ]);
    const evaluador = new BrakeDiscRulesEngine(umbrales);
    const estado = evaluador.clasificarEstadoConReperfilado(rd, h);

    const base = {
      discId,
      posicion,
      fechaUltimaMedicion: ultimaMedicion.fecha,
      h,
      t,
      rd,
      estado,
      tasaMensual,
      motivoUltimaMedicion: ultimaMedicion.motivo,
      responsableUltimaMedicion: ultimaMedicion.responsableNombre,
    };

    // Sin tasa (o una tasa degenerada <= 0, defensivo: no debería ocurrir con
    // wear_rate_pairs válidos ya filtrados) no hay con qué proyectar el
    // crecimiento de H — se informa la falta de datos en vez de reventar o
    // devolver un ciclo sin sentido (división por cero/negativa).
    if (tasaMensual === null || tasaMensual <= 0) {
      return {
        ...base,
        proyectable: false,
        motivo: `Sin datos suficientes de tasa de desgaste para el tipo de coche ${posicion.tipoCoche} en el rango de km configurado.`,
        ciclosReperfilado: [],
        cicloCambio: null,
        truncado: false,
      };
    }

    const resultado = proyectarCiclos(
      { h, rd, fecha: ultimaMedicion.fecha },
      tasaMensual,
      {
        hUmbralReperfilado: umbrales.hUmbralReperfilado,
        reperfiladoDescuentoRd: umbrales.reperfiladoDescuentoRd,
        rdUmbralSeguimiento: umbrales.rdUmbralSeguimiento,
        rdUmbralCambioProyeccion: umbrales.rdUmbralSeguimiento,
      },
    );

    return {
      ...base,
      proyectable: true,
      motivo: null,
      ciclosReperfilado: resultado.ciclosReperfilado,
      cicloCambio: resultado.cicloCambio,
      truncado: resultado.truncado,
    };
  }
}
