import { Injectable } from '@nestjs/common';
import type { LadoDisco, TipoCoche } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ORDEN_MAS_RECIENTE } from '../scan-records/accion-recomendada.query';
import { MeasurementGapConfigService } from './measurement-gap-config.service';

// "Hace cuánto no se mide" un disco: para cada disco físico con al menos 1
// medición CONFIRMADA, la diferencia en meses entre su medición más reciente
// y AHORA (no entre más reciente y más antigua del disco — es la alerta de
// "recomendado medir pronto", no una duración de vida útil del disco).

// Umbral SEVERO fijo — a propósito NUNCA lee measurement_gap_umbral_meses
// (ver MeasurementGapConfigService): un disco a 7+ meses sin medir es una
// alerta severa sin importar cómo esté configurado el umbral normal.
const UMBRAL_SEVERO_MESES = 7;

// Mismo cálculo de "meses entre 2 fechas" que proyeccion-calculator.engine.ts
// (365.25/12 días promedio por mes) — se repite acá en vez de importarlo
// porque es una utilidad de fecha genérica de una línea, no una dependencia
// real del módulo de Proyección.
const MS_POR_MES_PROMEDIO = (365.25 / 12) * 24 * 60 * 60 * 1000;
function mesesEntre(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / MS_POR_MES_PROMEDIO;
}

export type CategoriaMeasurementGap = 'normal' | 'alerta' | 'alertaSevera';

export interface FilaAlertaMeasurementGap {
  categoria: Exclude<CategoriaMeasurementGap, 'normal'>;
  tren: number;
  coche: TipoCoche;
  numeroCoche: number;
  bogie: string;
  eje: number;
  lado: LadoDisco;
  fechaUltimaMedicion: string; // ISO yyyy-mm-dd
  mesesSinMedir: number;
}

export interface MeasurementGapSummary {
  umbralMesesUsado: number;
  umbralSeveroMeses: number;
  conteos: Record<CategoriaMeasurementGap, number>;
  // Solo alerta + alertaSevera (normal no se lista, no hace falta para la
  // tabla de "ver detalle") — ordenados de más urgente a menos.
  discos: FilaAlertaMeasurementGap[];
}

function categorizar(
  mesesSinMedir: number,
  umbralMeses: number,
): CategoriaMeasurementGap {
  // >= 7 manda SIEMPRE, incluso si umbralMeses (configurable) fuera >= 7 por
  // sí solo — el orden de estos 2 checks es lo que garantiza esa prioridad.
  if (mesesSinMedir >= UMBRAL_SEVERO_MESES) return 'alertaSevera';
  if (mesesSinMedir >= umbralMeses) return 'alerta';
  return 'normal';
}

@Injectable()
export class MeasurementGapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MeasurementGapConfigService,
  ) {}

  async obtenerSummary(
    umbralMesesQuery?: number,
  ): Promise<MeasurementGapSummary> {
    const umbralMesesUsado =
      umbralMesesQuery ?? (await this.config.obtenerUmbralMeses());
    const ahora = new Date();

    // Medición CONFIRMADA más reciente de cada disco: se trae todo
    // scan_records con discId resuelto, ya ordenado más-reciente-primero
    // (ORDEN_MAS_RECIENTE), y se toma la primera aparición de cada discId —
    // mismo patrón que enriquecerAccionRecomendadaDraft
    // (accion-recomendada.query.ts).
    const registros = await this.prisma.scanRecord.findMany({
      where: { discId: { not: null } },
      select: { discId: true, fecha: true },
      orderBy: ORDEN_MAS_RECIENTE,
    });

    const ultimaPorDisco = new Map<string, Date>();
    for (const r of registros) {
      if (!r.discId || ultimaPorDisco.has(r.discId)) continue;
      ultimaPorDisco.set(r.discId, r.fecha);
    }

    const conteos: Record<CategoriaMeasurementGap, number> = {
      normal: 0,
      alerta: 0,
      alertaSevera: 0,
    };
    if (ultimaPorDisco.size === 0) {
      return {
        umbralMesesUsado,
        umbralSeveroMeses: UMBRAL_SEVERO_MESES,
        conteos,
        discos: [],
      };
    }

    const discos = await this.prisma.brakeDisc.findMany({
      // stage: 'en_servicio' — una pieza retirada a almacén/taller ya no
      // necesita medición periódica (no está desgastándose en un tren).
      where: {
        id: { in: [...ultimaPorDisco.keys()] },
        stage: 'en_servicio',
      },
      select: {
        id: true,
        bogieCodigo: true,
        ejeNumero: true,
        lado: true,
        wagonUnit: {
          select: {
            tipoCoche: true,
            numeroCoche: true,
            tren: { select: { numero: true } },
          },
        },
      },
    });

    const filas: FilaAlertaMeasurementGap[] = [];
    for (const disco of discos) {
      const fechaUltima = ultimaPorDisco.get(disco.id);
      if (!fechaUltima) continue;

      const meses = mesesEntre(fechaUltima, ahora);
      const categoria = categorizar(meses, umbralMesesUsado);
      conteos[categoria] += 1;

      if (categoria !== 'normal') {
        // wagonUnit/bogieCodigo/ejeNumero/lado no-null garantizados por el
        // where (stage: 'en_servicio') — Prisma no lo refleja en el tipo.
        filas.push({
          categoria,
          tren: disco.wagonUnit!.tren.numero,
          coche: disco.wagonUnit!.tipoCoche,
          numeroCoche: disco.wagonUnit!.numeroCoche,
          bogie: disco.bogieCodigo!,
          eje: disco.ejeNumero!,
          lado: disco.lado!,
          fechaUltimaMedicion: fechaUltima.toISOString().slice(0, 10),
          mesesSinMedir: Number(meses.toFixed(1)),
        });
      }
    }

    // Más urgente primero (más meses sin medir).
    filas.sort((a, b) => b.mesesSinMedir - a.mesesSinMedir);

    return {
      umbralMesesUsado,
      umbralSeveroMeses: UMBRAL_SEVERO_MESES,
      conteos,
      discos: filas,
    };
  }
}
