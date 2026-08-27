import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LadoDisco } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { DevolverAlmacenDto } from './dto/devolver-almacen.dto';
import type { EditarEjeDto } from './dto/editar-eje.dto';
import type { InventoryQueryDto } from './dto/inventory-query.dto';
import type { RegistrarEjeDto } from './dto/registrar-eje.dto';
import {
  buscarInventarioPaginado,
  obtenerStatsInventory,
  type InventoryResult,
  type InventoryStats,
} from './inventory-query';

const LADOS = ['izquierdo', 'derecho'] as const satisfies readonly LadoDisco[];

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

  // Alta de un EJE nuevo (izquierdo + derecho juntos) — wagonUnitId/
  // bogieCodigo/ejeNumero quedan null: todavía no tiene posición física.
  // `lado` sí se fija en ambos, es lo que permite emparejarlos como fila
  // única en Inventario incluso sueltos (ver claveGrupo en inventory-query.ts).
  async registrarEje(dto: RegistrarEjeDto) {
    const serie = dto.serie.trim();
    try {
      const [izquierdo, derecho] = await this.prisma.$transaction(
        LADOS.map((lado) =>
          this.prisma.brakeDisc.create({
            data: {
              serie,
              lado,
              lote: dto.lote?.trim() || null,
              fabricante: dto.fabricante ?? null,
              marcaRueda: dto.marcaRueda?.trim() || null,
              stage: dto.autoTaller ? 'taller' : 'almacen',
              fase: 'nueva',
            },
          }),
        ),
      );
      return { serie, discos: [izquierdo.id, derecho.id] };
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        throw new ConflictException(
          `Ya existe un eje registrado con la serie "${serie}".`,
        );
      }
      throw err;
    }
  }

  private async buscarPar(serie: string) {
    const discos = await this.prisma.brakeDisc.findMany({
      where: { serie, activo: true },
    });
    if (discos.length === 0) {
      throw new NotFoundException(
        `No se encontró ningún eje con serie "${serie}".`,
      );
    }
    return discos;
  }

  // Edita los campos de identidad compartidos del par (serie/lote/
  // fabricante/marcaRueda) — Estado/Fase/stage/último movimiento NO se
  // tocan acá, ver comentario de EditarEjeDto.
  async editarEje(serie: string, dto: EditarEjeDto) {
    const discos = await this.buscarPar(serie);
    const nuevaSerie = dto.serie?.trim();

    try {
      await this.prisma.$transaction(
        discos.map((d) =>
          this.prisma.brakeDisc.update({
            where: { id: d.id },
            data: {
              ...(nuevaSerie !== undefined ? { serie: nuevaSerie } : {}),
              ...(dto.lote !== undefined
                ? { lote: dto.lote.trim() || null }
                : {}),
              ...(dto.fabricante !== undefined
                ? { fabricante: dto.fabricante }
                : {}),
              ...(dto.marcaRueda !== undefined
                ? { marcaRueda: dto.marcaRueda.trim() || null }
                : {}),
            },
          }),
        ),
      );
      return { serie: nuevaSerie ?? serie };
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        throw new ConflictException(
          `Ya existe un eje registrado con la serie "${nuevaSerie}".`,
        );
      }
      throw err;
    }
  }

  // Baja lógica del eje completo (ambos lados) — mismo criterio que
  // cualquier borrado en el sistema: activo=false, nunca DELETE físico
  // (preserva historial de InventoryMovement/ScanRecord).
  async eliminarEje(serie: string) {
    const discos = await this.buscarPar(serie);
    await this.prisma.brakeDisc.updateMany({
      where: { id: { in: discos.map((d) => d.id) } },
      data: { activo: false },
    });
    return { eliminados: discos.length };
  }

  // Taller -> Almacén, acción manual desde Inventario (a diferencia de
  // Retiro Masivo en Operaciones, que es Almacén -> Taller). No toca fase:
  // si ya es 'usada' (volvió de servicio) se queda así para siempre, ver
  // regla de negocio en el comentario de BrakeDisc.fase.
  async devolverAlmacen(dto: DevolverAlmacenDto, usuarioId: string) {
    const operacionId = randomUUID();
    const discIds = [...new Set(dto.discIds)];

    const resultado = await this.prisma.brakeDisc.updateMany({
      where: { id: { in: discIds }, stage: 'taller' },
      data: { stage: 'almacen' },
    });
    if (resultado.count !== discIds.length) {
      throw new ConflictException(
        'Alguno de los discos seleccionados ya no está en Taller (puede que otra persona ya lo haya movido).',
      );
    }

    await this.prisma.inventoryMovement.createMany({
      data: discIds.map((brakeDiscId) => ({
        brakeDiscId,
        operacionId,
        tipo: 'devolucion_almacen' as const,
        etapaOrigen: 'taller' as const,
        etapaDestino: 'almacen' as const,
        encargadoNombre: dto.encargadoNombre,
        realizadoPor: usuarioId,
      })),
    });

    return { operacionId, discosDevueltos: discIds.length };
  }
}
