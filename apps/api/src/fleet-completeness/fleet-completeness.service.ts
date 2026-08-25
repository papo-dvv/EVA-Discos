import { Injectable, NotFoundException } from '@nestjs/common';
import type { LadoDisco, TipoCoche } from '../../generated/prisma';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { PrismaService } from '../prisma/prisma.service';

// Chequeo de completitud del catálogo de flota esperada (wagon_units +
// brake_discs, sembrado para los 39 trenes ALSTOM — ver prisma/seed.ts)
// contra el historial real de mediciones: por cada disco del catálogo, ¿tuvo
// alguna vez al menos una medición CONFIRMADA (ScanRecord con discId
// resuelto)? "Confirmada" a propósito: un disco con solo filas de una
// migración todavía en revisión (sin commit) sigue contando como "sin
// medición histórica" acá.

export interface FleetCompletenessTren {
  tren: number;
  discosEsperados: number;
  discosConAlMenosUnaMedicionHistorica: number;
  discosFaltantes: number;
}

export type FleetCompletenessTotal = Omit<FleetCompletenessTren, 'tren'>;

export interface FleetCompletenessSummary {
  porTren: FleetCompletenessTren[];
  total: FleetCompletenessTotal;
}

export interface FleetCompletenessDetalleFila {
  coche: TipoCoche;
  numeroCoche: number;
  bogie: string;
  eje: number;
  lado: LadoDisco;
}

@Injectable()
export class FleetCompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerSummary(): Promise<FleetCompletenessSummary> {
    // _count sobre la relación scanRecords: cuenta CUALQUIER ScanRecord con
    // este discId, lo cual solo puede pasar si ya pasó por el commit (los
    // borradores de migración tienen discId null hasta confirmarse) — así
    // que "> 0" ya implica "confirmada", sin necesidad de un where aparte.
    const discos = await this.prisma.brakeDisc.findMany({
      // stage: 'en_servicio' — el catálogo esperado de flota es sobre piezas
      // montadas; sin este filtro, una pieza en almacen/taller (wagonUnit
      // null) rompería el acceso a wagonUnit.tren de abajo.
      where: { activo: true, stage: 'en_servicio' },
      select: {
        wagonUnit: { select: { tren: { select: { numero: true } } } },
        _count: { select: { scanRecords: true } },
      },
    });

    const porTrenMap = new Map<
      number,
      { discosEsperados: number; conMedicion: number }
    >();
    for (const disco of discos) {
      const tren = disco.wagonUnit!.tren.numero;
      const actual = porTrenMap.get(tren) ?? {
        discosEsperados: 0,
        conMedicion: 0,
      };
      actual.discosEsperados += 1;
      if (disco._count.scanRecords > 0) actual.conMedicion += 1;
      porTrenMap.set(tren, actual);
    }

    const porTren: FleetCompletenessTren[] = [...porTrenMap.entries()]
      .map(([tren, r]) => ({
        tren,
        discosEsperados: r.discosEsperados,
        discosConAlMenosUnaMedicionHistorica: r.conMedicion,
        discosFaltantes: r.discosEsperados - r.conMedicion,
      }))
      .sort((a, b) => a.tren - b.tren);

    const total = porTren.reduce<FleetCompletenessTotal>(
      (acc, f) => ({
        discosEsperados: acc.discosEsperados + f.discosEsperados,
        discosConAlMenosUnaMedicionHistorica:
          acc.discosConAlMenosUnaMedicionHistorica +
          f.discosConAlMenosUnaMedicionHistorica,
        discosFaltantes: acc.discosFaltantes + f.discosFaltantes,
      }),
      {
        discosEsperados: 0,
        discosConAlMenosUnaMedicionHistorica: 0,
        discosFaltantes: 0,
      },
    );

    return { porTren, total };
  }

  // Combinaciones exactas del catálogo esperado de `tren` que NUNCA tuvieron
  // ninguna medición confirmada — para la ventana flotante de "ver detalle".
  async obtenerDetalle(tren: number): Promise<FleetCompletenessDetalleFila[]> {
    const trenRow = await this.prisma.train.findUnique({
      where: { numero: tren },
    });
    if (!trenRow) {
      throw new NotFoundException(`El tren ${tren} no existe.`);
    }

    const discos = await this.prisma.brakeDisc.findMany({
      where: {
        activo: true,
        stage: 'en_servicio',
        wagonUnit: { tren: { numero: tren } },
      },
      select: {
        bogieCodigo: true,
        ejeNumero: true,
        lado: true,
        ruedaNumero: true,
        wagonUnit: { select: { tipoCoche: true, numeroCoche: true } },
        _count: { select: { scanRecords: true } },
      },
    });

    // bogieCodigo/ejeNumero/lado/wagonUnit no-null garantizados por el where
    // (stage: 'en_servicio') — Prisma no lo refleja en el tipo generado.
    return discos
      .filter((d) => d._count.scanRecords === 0)
      .sort(
        (a, b) =>
          calcularOrdenFisico({
            tipoCoche: a.wagonUnit!.tipoCoche,
            bogieCodigo: a.bogieCodigo!,
            ejeNumero: a.ejeNumero!,
            ruedaNumero: a.ruedaNumero,
          }) -
          calcularOrdenFisico({
            tipoCoche: b.wagonUnit!.tipoCoche,
            bogieCodigo: b.bogieCodigo!,
            ejeNumero: b.ejeNumero!,
            ruedaNumero: b.ruedaNumero,
          }),
      )
      .map((d) => ({
        coche: d.wagonUnit!.tipoCoche,
        numeroCoche: d.wagonUnit!.numeroCoche,
        bogie: d.bogieCodigo!,
        eje: d.ejeNumero!,
        lado: d.lado!,
      }));
  }
}
