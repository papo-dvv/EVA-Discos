import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RetiroMasivoDto } from './dto/retiro-masivo.dto';

// Discos por lote dentro de cada transacción corta — mismo criterio que
// MigrationCommitService (evita el timeout de 5s por defecto de una
// transacción interactiva de Prisma en listas grandes).
const TAMANO_LOTE = 500;

@Injectable()
export class OperationsRetiroMasivoService {
  constructor(private readonly prisma: PrismaService) {}

  // Almacén -> Taller para cada disco seleccionado. Un solo operacionId
  // agrupa todas las filas de InventoryMovement generadas por este retiro
  // (ver comentario en el modelo) — así "qué se retiró en este trámite"
  // queda reconstruible aunque el módulo Historial todavía no exista.
  async retirar(
    dto: RetiroMasivoDto,
    usuarioId: string,
  ): Promise<{ operacionId: string; discosRetirados: number }> {
    const operacionId = randomUUID();
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const discIds = [...new Set(dto.discIds)];

    for (let i = 0; i < discIds.length; i += TAMANO_LOTE) {
      const lote = discIds.slice(i, i + TAMANO_LOTE);
      await this.prisma.$transaction(
        async (tx) => {
          const resultado = await tx.brakeDisc.updateMany({
            where: { id: { in: lote }, stage: 'almacen' },
            data: { stage: 'taller' },
          });
          if (resultado.count !== lote.length) {
            throw new ConflictException(
              'Alguno de los discos seleccionados ya no está en Almacén (puede que otra persona ya lo haya movido).',
            );
          }
          await tx.inventoryMovement.createMany({
            data: lote.map((brakeDiscId) => ({
              brakeDiscId,
              operacionId,
              tipo: 'retiro_masivo' as const,
              etapaOrigen: 'almacen' as const,
              etapaDestino: 'taller' as const,
              encargadoNombre: dto.encargadoNombre,
              encargadoFirma: dto.encargadoFirma ?? null,
              fecha,
              realizadoPor: usuarioId,
            })),
          });
        },
        { timeout: 10_000 },
      );
    }

    return { operacionId, discosRetirados: discIds.length };
  }
}
