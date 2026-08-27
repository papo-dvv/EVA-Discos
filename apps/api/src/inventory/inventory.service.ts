import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LadoDisco } from '../../generated/prisma';
import { agruparPorMes } from '../common/agrupar-por-mes';
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

export interface PuntoRetirosMes {
  mes: string;
  retirados: number;
}

export interface CambiosDiscoAnio {
  anio: number;
  total: number;
}

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

  // Serie mensual de discos retirados de Almacén (Almacén -> Taller, ver
  // OperationsRetiroMasivoService — un InventoryMovement con
  // tipo='retiro_masivo' es siempre 1 disco físico, no un par), usada por el
  // gráfico "Flujo mensual de discos" del dashboard. Siempre los 12 meses del
  // AÑO CALENDARIO en curso (enero a diciembre, pedido explícito — mismo
  // criterio que WearRateService.obtenerChartPorTipoCoche), con 0 explícito
  // en los meses sin ningún retiro (incluidos los futuros, todavía sin
  // ocurrir) — "sin retiros" es un dato real, no la ausencia de dato.
  async obtenerRetirosPorMes(): Promise<PuntoRetirosMes[]> {
    const anioActual = new Date().getUTCFullYear();

    const movimientos = await this.prisma.inventoryMovement.findMany({
      where: {
        tipo: 'retiro_masivo',
        fecha: {
          gte: new Date(Date.UTC(anioActual, 0, 1)),
          lt: new Date(Date.UTC(anioActual + 1, 0, 1)),
        },
      },
      select: { fecha: true },
    });
    const porMes = agruparPorMes(
      movimientos,
      (m) => m.fecha,
      () => 0,
      (acumulado) => acumulado + 1,
    );

    return Array.from({ length: 12 }, (_, i) => {
      const mes = new Date(Date.UTC(anioActual, i, 1))
        .toISOString()
        .slice(0, 7);
      return { mes, retirados: porMes.get(mes) ?? 0 };
    });
  }

  // Total de InventoryMovement tipo='cambio_disco' (reemplazo físico real en
  // el tren, ver OperationsCambioDiscoService) del AÑO CALENDARIO en curso —
  // distinto de obtenerRetirosPorMes (retiro_masivo = Almacén->Taller, no es
  // un cambio ejecutado). Usado por la card "Avance del año" de Análisis de
  // Proyección para comparar contra el total proyectado del año.
  async obtenerCambiosDiscoAnio(): Promise<CambiosDiscoAnio> {
    const anioActual = new Date().getUTCFullYear();
    const total = await this.prisma.inventoryMovement.count({
      where: {
        tipo: 'cambio_disco',
        fecha: {
          gte: new Date(Date.UTC(anioActual, 0, 1)),
          lt: new Date(Date.UTC(anioActual + 1, 0, 1)),
        },
      },
    });
    return { anio: anioActual, total };
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
