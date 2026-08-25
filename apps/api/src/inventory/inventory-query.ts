import type { EstadoDisco, Prisma } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryQueryDto } from './dto/inventory-query.dto';

// WHERE/paginación/mapeo de BrakeDisc para GET /inventory — mismo espíritu
// que scan-record-query.ts (construirWhereScanRecord/aPreviewRow) pero para
// la identidad física del disco en vez de sus mediciones.

export interface InventoryRow {
  id: string;
  serie: string | null;
  stage: 'almacen' | 'taller' | 'en_servicio';
  fase: 'nueva' | 'usada';
  marcaRueda: string | null;
  fabricante: string | null;
  tValue: number | null;
  hValue: number | null;
  rdValue: number | null;
  estadoCalculado: EstadoDisco | null;
  // "Suelta en almacén" / "En taller" / "Tren N · Coche · Bogie · Eje E · lado".
  asociacion: string;
  ultimoMovimiento: {
    tipo: 'retiro_masivo' | 'cambio_disco';
    fecha: string;
    encargadoNombre: string;
  } | null;
}

export interface InventoryResult {
  rows: InventoryRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface InventoryStats {
  almacen: number;
  taller: number;
  en_servicio: number;
}

export function construirWhereInventory(
  q: InventoryQueryDto,
): Prisma.BrakeDiscWhereInput {
  const where: Prisma.BrakeDiscWhereInput = { activo: true };
  if (q.stage?.length) where.stage = { in: q.stage };
  if (q.fase?.length) where.fase = { in: q.fase };
  const search = q.search?.trim();
  if (search) {
    where.OR = [
      { serie: { contains: search, mode: 'insensitive' } },
      { marcaRueda: { contains: search, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

const LADO_ETIQUETA: Record<'izquierdo' | 'derecho', string> = {
  izquierdo: 'izquierdo',
  derecho: 'derecho',
};

function resolverAsociacion(disco: {
  stage: string;
  bogieCodigo: string | null;
  ejeNumero: number | null;
  lado: 'izquierdo' | 'derecho' | null;
  wagonUnit: {
    tipoCoche: string;
    numeroCoche: number;
    tren: { numero: number };
  } | null;
}): string {
  if (disco.stage === 'en_servicio' && disco.wagonUnit) {
    return `Tren ${disco.wagonUnit.tren.numero} · ${disco.wagonUnit.tipoCoche} ${disco.wagonUnit.numeroCoche} · Bogie ${disco.bogieCodigo} · Eje ${disco.ejeNumero} ${disco.lado ? LADO_ETIQUETA[disco.lado] : ''}`.trim();
  }
  return disco.stage === 'taller' ? 'En taller' : 'Suelta en almacén';
}

export async function buscarInventarioPaginado(
  prisma: PrismaService,
  q: InventoryQueryDto,
): Promise<InventoryResult> {
  const where = construirWhereInventory(q);
  const [total, discos] = await prisma.$transaction([
    prisma.brakeDisc.count({ where }),
    prisma.brakeDisc.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        proveedor: { select: { nombre: true } },
        wagonUnit: {
          select: {
            tipoCoche: true,
            numeroCoche: true,
            tren: { select: { numero: true } },
          },
        },
      },
    }),
  ]);

  // N+1 deliberado, acotado al tamaño de página (nunca a toda la tabla) —
  // mismo criterio que resolverAccionPorDiscId (accion-recomendada.query.ts):
  // Prisma no expresa "última fila por grupo" en una sola consulta.
  const rows = await Promise.all(
    discos.map(async (disco): Promise<InventoryRow> => {
      const [ultimaMedicion, ultimoMovimiento] = await Promise.all([
        prisma.scanRecord.findFirst({
          where: { discId: disco.id, file: { status: 'committed' } },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: {
            tValue: true,
            hValue: true,
            rdValue: true,
            estadoCalculado: true,
          },
        }),
        prisma.inventoryMovement.findFirst({
          where: { brakeDiscId: disco.id },
          orderBy: { createdAt: 'desc' },
          select: { tipo: true, fecha: true, encargadoNombre: true },
        }),
      ]);

      return {
        id: disco.id,
        serie: disco.serie,
        stage: disco.stage,
        fase: disco.fase,
        marcaRueda: disco.marcaRueda,
        fabricante: disco.proveedor?.nombre ?? null,
        tValue: ultimaMedicion ? Number(ultimaMedicion.tValue) : null,
        hValue: ultimaMedicion ? Number(ultimaMedicion.hValue) : null,
        rdValue: ultimaMedicion ? ultimaMedicion.rdValue : null,
        estadoCalculado: ultimaMedicion?.estadoCalculado ?? null,
        asociacion: resolverAsociacion(disco),
        ultimoMovimiento: ultimoMovimiento
          ? {
              tipo: ultimoMovimiento.tipo,
              fecha: ultimoMovimiento.fecha.toISOString().slice(0, 10),
              encargadoNombre: ultimoMovimiento.encargadoNombre,
            }
          : null,
      };
    }),
  );

  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  return { rows, page: q.page, pageSize: q.pageSize, total, totalPages };
}

export async function obtenerStatsInventory(
  prisma: PrismaService,
): Promise<InventoryStats> {
  const grupos = await prisma.brakeDisc.groupBy({
    by: ['stage'],
    where: { activo: true },
    _count: { _all: true },
  });
  const porStage = new Map(grupos.map((g) => [g.stage, g._count._all]));
  return {
    almacen: porStage.get('almacen') ?? 0,
    taller: porStage.get('taller') ?? 0,
    en_servicio: porStage.get('en_servicio') ?? 0,
  };
}
