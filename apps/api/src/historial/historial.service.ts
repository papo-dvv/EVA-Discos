import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma';
import { NewMeasurementHistoryService } from '../new-measurement/new-measurement-history.service';
import { PrismaService } from '../prisma/prisma.service';

export type TipoEventoHistorial = 'CAMBIO_DISCO' | 'MEDICION' | 'REPERFILADO';

export interface EventoHistorial {
  tipo: TipoEventoHistorial;
  fecha: string; // ISO
  trenNumero: number | null;
  cocheNumero: number | null;
  bogieCodigo: string | null;
  ejeNumero: number | null;
  descripcion: string;
}

export interface FiltrosHistorial {
  tipo?: TipoEventoHistorial[];
  desde?: string;
  hasta?: string;
  tren?: number;
  limit?: number;
}

export interface KpisHistorial {
  total: number;
  ultimaSemana: number;
  trenesAfectados: number;
  tiposDiferentes: number;
}

// Capa de AGREGACIÓN/LECTURA sobre datos ya existentes (InventoryMovement +
// MeasurementHistoryEvent) — deliberadamente NO una tabla de eventos de
// primera clase estilo HistorialOperacion de EVA-Aldy: EVA ya persiste cada
// uno de estos hechos en el flujo de negocio real (Operaciones escribe
// InventoryMovement, NewMeasurement escribe MeasurementHistoryEvent al
// confirmar), así que unificarlos en un solo feed de lectura cubre el pedido
// ("contador" de cambios de disco reales, reperfilados y mediciones) sin
// migración de schema ni instrumentar servicios que ya funcionan.
@Injectable()
export class HistorialService {
  constructor(
    private readonly prisma: PrismaService,
    // Instancia propia (mismo patrón que WearRateModule con
    // TraceabilityStatsService/ConsensoConfigService): NewMeasurementModule
    // no exporta este servicio, y solo depende de PrismaService, así que
    // declararlo acá como provider propio no duplica estado real, solo la
    // instancia de la clase.
    private readonly newMeasurementHistory: NewMeasurementHistoryService,
  ) {}

  async listar(filtros: FiltrosHistorial): Promise<EventoHistorial[]> {
    const todos = await this.obtenerTodosEventos(filtros);
    const filtrados = filtros.tipo?.length
      ? todos.filter((e) => filtros.tipo!.includes(e.tipo))
      : todos;
    return filtrados.slice(0, filtros.limit ?? 50);
  }

  async kpis(
    filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>,
  ): Promise<KpisHistorial> {
    const todos = await this.obtenerTodosEventos(filtros);
    const haceUnaSemana = new Date();
    haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);

    return {
      total: todos.length,
      ultimaSemana: todos.filter((e) => new Date(e.fecha) >= haceUnaSemana)
        .length,
      trenesAfectados: new Set(
        todos.map((e) => e.trenNumero).filter((n): n is number => n !== null),
      ).size,
      tiposDiferentes: new Set(todos.map((e) => e.tipo)).size,
    };
  }

  private async obtenerTodosEventos(
    filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>,
  ): Promise<EventoHistorial[]> {
    const [cambios, mediciones, reperfilados] = await Promise.all([
      this.obtenerEventosCambioDisco(filtros),
      this.obtenerEventosFicha(filtros, 'Medición', 'MEDICION'),
      this.obtenerEventosFicha(filtros, 'Reperfilado', 'REPERFILADO'),
    ]);

    return [...cambios, ...mediciones, ...reperfilados].sort((a, b) =>
      b.fecha.localeCompare(a.fecha),
    );
  }

  // Un evento por EJE cambiado (izquierdo+derecho colapsados) — mismo
  // criterio de deduplicación que InventoryService.obtenerCambiosRealesPorMes,
  // pero a nivel de evento individual en vez de conteo mensual: etapaDestino
  // 'en_servicio' toma solo el lado ALTA (evita contar BAJA+ALTA del mismo
  // eje como 2 eventos), y se agrupa por fecha+eje porque una operación de
  // cambio escribe 2 filas (una por disco/lado) para el mismo eje físico.
  private async obtenerEventosCambioDisco(
    filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>,
  ): Promise<EventoHistorial[]> {
    const where: Prisma.InventoryMovementWhereInput = {
      tipo: 'cambio_disco',
      etapaDestino: 'en_servicio',
      ...(filtros.desde || filtros.hasta
        ? {
            fecha: {
              ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
              ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}),
            },
          }
        : {}),
      ...(filtros.tren !== undefined
        ? { brakeDisc: { wagonUnit: { tren: { numero: filtros.tren } } } }
        : {}),
    };

    const movimientos = await this.prisma.inventoryMovement.findMany({
      where,
      orderBy: { fecha: 'desc' },
      select: {
        fecha: true,
        brakeDisc: {
          select: {
            wagonUnitId: true,
            bogieCodigo: true,
            ejeNumero: true,
            wagonUnit: {
              select: {
                tipoCoche: true,
                numeroCoche: true,
                tren: { select: { numero: true } },
              },
            },
          },
        },
      },
    });

    const vistos = new Set<string>();
    const eventos: EventoHistorial[] = [];
    for (const m of movimientos) {
      const { wagonUnitId, bogieCodigo, ejeNumero, wagonUnit } = m.brakeDisc;
      const clave = `${m.fecha.toISOString()}:${wagonUnitId}:${bogieCodigo}:${ejeNumero}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      eventos.push({
        tipo: 'CAMBIO_DISCO',
        fecha: m.fecha.toISOString(),
        trenNumero: wagonUnit?.tren.numero ?? null,
        cocheNumero: wagonUnit?.numeroCoche ?? null,
        bogieCodigo: bogieCodigo,
        ejeNumero: ejeNumero,
        descripcion:
          `Cambio de disco — ${wagonUnit?.tipoCoche ?? '?'} ${wagonUnit?.numeroCoche ?? ''} · ${bogieCodigo ?? '?'} E${ejeNumero ?? '?'}`.trim(),
      });
    }
    return eventos;
  }

  // Reusa NewMeasurementHistoryService.listar() (ya filtra por motivo vía
  // ficha.motivo/detalle) en vez de consultar MeasurementSheet directo — es
  // la misma fuente que ya alimenta la card de historial de Nuevas
  // Mediciones. Solo 'ficha_confirmada' cuenta como evento "real" acá (mismo
  // criterio que cambio_disco: el hecho ya consumado, no cada paso
  // intermedio de edición/verificación/bloqueo).
  private async obtenerEventosFicha(
    filtros: Pick<FiltrosHistorial, 'desde' | 'hasta' | 'tren'>,
    motivo: 'Medición' | 'Reperfilado',
    tipo: 'MEDICION' | 'REPERFILADO',
  ): Promise<EventoHistorial[]> {
    const eventos = await this.newMeasurementHistory.listar(10_000, motivo);
    return eventos
      .filter((e) => e.tipo === 'ficha_confirmada')
      .filter(
        (e) => filtros.tren === undefined || e.trenNumero === filtros.tren,
      )
      .filter((e) => {
        if (!filtros.desde && !filtros.hasta) return true;
        const fecha = e.createdAt;
        if (filtros.desde && fecha < filtros.desde) return false;
        if (filtros.hasta && fecha > filtros.hasta) return false;
        return true;
      })
      .map((e) => ({
        tipo,
        fecha: e.createdAt,
        trenNumero: e.trenNumero,
        cocheNumero: null,
        bogieCodigo: null,
        ejeNumero: null,
        descripcion: `${motivo} confirmada — Tren ${e.trenNumero}`,
      }));
  }
}
