import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RegistrarDiscoDto } from './dto/registrar-disco.dto';
import type { InventoryQueryDto } from './dto/inventory-query.dto';
import {
  buscarInventarioPaginado,
  obtenerStatsInventory,
  type InventoryResult,
  type InventoryStats,
} from './inventory-query';

function esViolacionUnicidad(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: InventoryQueryDto): Promise<InventoryResult> {
    return buscarInventarioPaginado(this.prisma, query);
  }

  async obtenerStats(): Promise<InventoryStats> {
    return obtenerStatsInventory(this.prisma);
  }

  // Alta de una pieza nueva de stock — siempre entra por Almacén, fase
  // Nueva (ver comentario en RegistrarDiscoDto). wagonUnitId/bogieCodigo/
  // ejeNumero/lado quedan null: todavía no tiene posición física.
  async registrar(dto: RegistrarDiscoDto) {
    try {
      return await this.prisma.brakeDisc.create({
        data: {
          serie: dto.serie.trim(),
          marcaRueda: dto.marcaRueda?.trim() || null,
          proveedorId: dto.proveedorId ?? null,
          stage: 'almacen',
          fase: 'nueva',
        },
      });
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        throw new ConflictException(
          `Ya existe una pieza registrada con la serie "${dto.serie}".`,
        );
      }
      throw err;
    }
  }
}
