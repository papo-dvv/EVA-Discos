import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export type TipoEventoHistorialMigracion =
  | 'migracion_subida'
  | 'migracion_confirmada'
  | 'migracion_cancelada';

export interface EventoHistorialMigracionInput {
  tipo: TipoEventoHistorialMigracion;
  fileId?: string | null;
  nombreArchivo?: string | null;
  alcance?: string | null;
  marca?: string | null;
  trenNumero?: number | null;
  totalFilas?: number | null;
  filasValidas?: number | null;
  filasInvalidas?: number | null;
  detalle?: string | null;
  usuarioId: string;
}

export interface EventoHistorialMigracionApi {
  id: string;
  tipo: TipoEventoHistorialMigracion;
  fileId: string | null;
  nombreArchivo: string | null;
  alcance: string | null;
  marca: string | null;
  trenNumero: number | null;
  totalFilas: number | null;
  filasValidas: number | null;
  filasInvalidas: number | null;
  detalle: string | null;
  usuarioNombre: string;
  createdAt: string;
}

type FilaHistorialMigracion = {
  id: string;
  tipo: TipoEventoHistorialMigracion;
  file_id: string | null;
  nombre_archivo: string | null;
  alcance: string | null;
  marca: string | null;
  tren_numero: number | null;
  total_filas: number | null;
  filas_validas: number | null;
  filas_invalidas: number | null;
  detalle: string | null;
  usuario_nombre: string;
  created_at: Date;
};

@Injectable()
export class MigrationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    evento: EventoHistorialMigracionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.$executeRaw`
      INSERT INTO migration_history_events (
        tipo,
        file_id,
        nombre_archivo,
        alcance,
        marca,
        tren_numero,
        total_filas,
        filas_validas,
        filas_invalidas,
        detalle,
        usuario_id
      )
      VALUES (
        ${evento.tipo},
        ${evento.fileId ?? null}::uuid,
        ${evento.nombreArchivo ?? null},
        ${evento.alcance ?? null},
        ${evento.marca ?? null},
        ${evento.trenNumero ?? null},
        ${evento.totalFilas ?? null},
        ${evento.filasValidas ?? null},
        ${evento.filasInvalidas ?? null},
        ${evento.detalle ?? null},
        ${evento.usuarioId}::uuid
      )
    `;
  }

  async listar(limit = 50): Promise<EventoHistorialMigracionApi[]> {
    const eventos = await this.prisma.$queryRaw<FilaHistorialMigracion[]>`
      SELECT
        mhe.id,
        mhe.tipo,
        mhe.file_id,
        mhe.nombre_archivo,
        mhe.alcance,
        mhe.marca,
        mhe.tren_numero,
        mhe.total_filas,
        mhe.filas_validas,
        mhe.filas_invalidas,
        mhe.detalle,
        u.nombres_completos AS usuario_nombre,
        mhe.created_at
      FROM migration_history_events mhe
      INNER JOIN users u ON u.id = mhe.usuario_id
      ORDER BY mhe.created_at DESC
      LIMIT ${limit}
    `;

    return eventos.map((evento) => ({
      id: evento.id,
      tipo: evento.tipo,
      fileId: evento.file_id,
      nombreArchivo: evento.nombre_archivo,
      alcance: evento.alcance,
      marca: evento.marca,
      trenNumero: evento.tren_numero,
      totalFilas: evento.total_filas,
      filasValidas: evento.filas_validas,
      filasInvalidas: evento.filas_invalidas,
      detalle: evento.detalle,
      usuarioNombre: evento.usuario_nombre,
      createdAt: evento.created_at.toISOString(),
    }));
  }
}
