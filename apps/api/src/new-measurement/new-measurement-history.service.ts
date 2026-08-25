import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type TipoEventoHistorialMedicion,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { MotivoFicha } from './new-measurement-csv.parser';

// Foto de una fila de medición (eje/lado/T/H) tal como quedó en snapshot_filas
// — usada por ficha_reiniciada para poder comparar contra una re-subida
// posterior aunque los ScanRecord originales ya se hayan borrado (ver
// NewMeasurementCommitService.reiniciar y NewMeasurementService.subirCsv).
export interface FilaSnapshotHistorial {
  eje: number | null;
  lado: string | null;
  t: number;
  h: number;
}

export interface EventoHistorialInput {
  tipo: TipoEventoHistorialMedicion;
  trenNumero: number;
  fichaId?: string | null;
  nombreArchivo?: string | null;
  fechaFicha?: Date | null;
  kilometraje?: number | null;
  snapshotFilas?: FilaSnapshotHistorial[] | null;
  detalle?: string | null;
  usuarioId: string;
}

export interface EventoHistorialApi {
  id: string;
  tipo: TipoEventoHistorialMedicion;
  trenNumero: number;
  fichaId: string | null;
  nombreArchivo: string | null;
  usuarioNombre: string;
  detalle: string | null;
  createdAt: string;
}

// Historial GLOBAL (todos los trenes, un solo feed) de eventos de ciclo de
// vida de una ficha de medición — alimenta la card lateral de Nuevas
// Mediciones. Complementa a ScanEditLog (campo-por-campo, no expuesto en
// ninguna UI): acá se registran eventos de negocio completos (se subió un
// CSV, se bloqueó/canceló/confirmó una ficha, etc.), y sobrevive a la
// cancelación de la ficha (ver MeasurementHistoryEvent.fichaId, onDelete:SetNull).
@Injectable()
export class NewMeasurementHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  // `tx` opcional: la mayoría de los puntos de instrumentación ya escriben
  // dentro de una transacción existente (ver reiniciar/confirmar) — pasarla
  // acá evita una escritura fuera de esa transacción que podría quedar
  // huérfana si el resto del commit falla.
  async registrar(
    evento: EventoHistorialInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const ficha = evento.fichaId
      ? await client.measurementSheet.findUnique({
          where: { id: evento.fichaId },
          select: { motivo: true },
        })
      : null;
    const detalle = [evento.detalle, ficha?.motivo ? `motivo:${ficha.motivo}` : null]
      .filter(Boolean)
      .join('\n');

    await client.measurementHistoryEvent.create({
      data: {
        tipo: evento.tipo,
        trenNumero: evento.trenNumero,
        fichaId: evento.fichaId ?? null,
        nombreArchivo: evento.nombreArchivo ?? null,
        fechaFicha: evento.fechaFicha ?? null,
        kilometraje: evento.kilometraje ?? null,
        snapshotFilas: evento.snapshotFilas
          ? (evento.snapshotFilas as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        detalle: detalle || null,
        usuarioId: evento.usuarioId,
      },
    });
  }

  async listar(limit = 50, motivo?: MotivoFicha): Promise<EventoHistorialApi[]> {
    const eventos = await this.prisma.measurementHistoryEvent.findMany({
      where: motivo
        ? {
            OR: [
              { ficha: { motivo } },
              { detalle: { contains: `motivo:${motivo}` } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { usuario: { select: { nombresCompletos: true } } },
    });

    return eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      trenNumero: e.trenNumero,
      fichaId: e.fichaId,
      nombreArchivo: e.nombreArchivo,
      usuarioNombre: e.usuario.nombresCompletos,
      detalle: e.detalle,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  // Evento más reciente de este tren, de CUALQUIER tipo — usado por
  // NewMeasurementService.subirCsv para detectar una re-subida idéntica
  // inmediatamente después de "Resubir CSV"/"Reiniciar ficha" (solo aplica si
  // el más reciente es justo ficha_reiniciada; ver ahí el criterio de
  // alcance angosto).
  async buscarUltimoEventoDeTren(trenNumero: number) {
    return this.prisma.measurementHistoryEvent.findFirst({
      where: { trenNumero },
      orderBy: { createdAt: 'desc' },
    });
  }
}
