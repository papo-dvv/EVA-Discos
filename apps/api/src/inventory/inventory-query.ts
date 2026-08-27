import type {
  EstadoDisco,
  FaseDisco,
  InventoryStage,
  ModeloTren,
  Prisma,
} from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryQueryDto } from './dto/inventory-query.dto';

// WHERE/paginación/mapeo de BrakeDisc para GET /inventory. A diferencia de
// scan-record-query.ts (1 fila = 1 registro), acá 1 fila = 1 EJE: izquierdo
// y derecho de la misma pieza física (comparten `serie`, ver comentario en
// schema.prisma) se agrupan en una sola fila con 2 sub-objetos.

export interface LadoInventario {
  discoId: string;
  tValue: number | null;
  hValue: number | null;
  rdValue: number | null;
  estadoCalculado: EstadoDisco | null;
}

export interface PosicionInventario {
  trenNumero: number;
  modeloVagon: string;
  numeroCoche: number;
  bogieCodigo: string;
  ejeNumero: number;
}

export interface InventoryRow {
  clave: string;
  serie: string | null;
  stage: InventoryStage;
  fase: FaseDisco;
  lote: string | null;
  fabricante: ModeloTren | null;
  marcaRueda: string | null;
  // Solo se llena en_servicio — de dónde está montado el eje.
  posicion: PosicionInventario | null;
  izquierdo: LadoInventario | null;
  derecho: LadoInventario | null;
  // "Suelto en taller" / "Suelto en almacén" / "Tren N · Coche · Bogie · Eje E".
  asociacion: string;
  ultimoMovimiento: {
    tipo: 'retiro_masivo' | 'cambio_disco' | 'devolucion_almacen';
    fecha: string;
    encargadoNombre: string;
    supervisorNombre: string | null;
    numeroPt: string | null;
    justificacion: string | null;
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
  if (q.fabricante?.length) where.fabricante = { in: q.fabricante };
  const search = q.search?.trim();
  if (search) {
    where.OR = [
      { serie: { contains: search, mode: 'insensitive' } },
      { marcaRueda: { contains: search, mode: 'insensitive' } },
      { lote: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

// Clave de agrupación por eje: en_servicio agrupa por posición física
// (izq/der del mismo wagon+bogie+eje); taller/almacén (sueltos, sin
// posición) agrupan por serie — ver comentario de BrakeDisc.serie. Un disco
// sin serie ni posición (caso borde, no debería ocurrir tras el backfill de
// prisma/seed.ts) queda solo en su propia "pareja" de 1.
function claveGrupo(disco: {
  id: string;
  serie: string | null;
  stage: InventoryStage;
  wagonUnitId: string | null;
  bogieCodigo: string | null;
  ejeNumero: number | null;
}): string {
  if (
    disco.stage === 'en_servicio' &&
    disco.wagonUnitId &&
    disco.bogieCodigo &&
    disco.ejeNumero !== null
  ) {
    return `pos:${disco.wagonUnitId}:${disco.bogieCodigo}:${disco.ejeNumero}`;
  }
  return disco.serie ? `serie:${disco.serie}` : `id:${disco.id}`;
}

function resolverAsociacion(
  stage: InventoryStage,
  posicion: PosicionInventario | null,
): string {
  if (stage === 'en_servicio' && posicion) {
    return `Tren ${posicion.trenNumero} · ${posicion.modeloVagon} ${posicion.numeroCoche} · Bogie ${posicion.bogieCodigo} · Eje ${posicion.ejeNumero}`;
  }
  return stage === 'taller' ? 'Suelto en taller' : 'Suelto en almacén';
}

export async function buscarInventarioPaginado(
  prisma: PrismaService,
  q: InventoryQueryDto,
): Promise<InventoryResult> {
  const where = construirWhereInventory(q);

  // Paso 1: campos livianos de TODAS las filas que matchean el filtro, para
  // poder paginar a nivel de EJE (par), no de disco individual — Prisma no
  // agrupa+pagina en una sola consulta, así que se arma en memoria. El total
  // de discos de la app es chico (miles, no millones), así que esto no es un
  // problema de escala real.
  const livianos = await prisma.brakeDisc.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      serie: true,
      stage: true,
      wagonUnitId: true,
      bogieCodigo: true,
      ejeNumero: true,
      createdAt: true,
    },
  });

  const grupos = new Map<string, typeof livianos>();
  for (const d of livianos) {
    const clave = claveGrupo(d);
    const lista = grupos.get(clave) ?? [];
    lista.push(d);
    grupos.set(clave, lista);
  }
  // Ya viene ordenado desc por createdAt de la query; cada grupo conserva el
  // orden de su primer miembro encontrado (el más reciente).
  const clavesOrdenadas = [...grupos.keys()];

  const total = clavesOrdenadas.length;
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
  const inicio = (q.page - 1) * q.pageSize;
  const clavesPagina = clavesOrdenadas.slice(inicio, inicio + q.pageSize);
  const idsPagina = clavesPagina.flatMap((clave) =>
    grupos.get(clave)!.map((d) => d.id),
  );

  if (idsPagina.length === 0) {
    return { rows: [], page: q.page, pageSize: q.pageSize, total, totalPages };
  }

  // Paso 2: datos completos SOLO de los discos de la página actual.
  const discos = await prisma.brakeDisc.findMany({
    where: { id: { in: idsPagina } },
    include: {
      wagonUnit: {
        select: {
          tipoCoche: true,
          numeroCoche: true,
          tren: { select: { numero: true } },
        },
      },
    },
  });
  const discoPorId = new Map(discos.map((d) => [d.id, d]));

  // N+1 deliberado, acotado al tamaño de página — mismo criterio que
  // resolverAccionPorDiscId (accion-recomendada.query.ts): Prisma no expresa
  // "última fila por grupo" en una sola consulta.
  const medicionesYMovimientos = await Promise.all(
    idsPagina.map(async (id) => {
      const [ultimaMedicion, ultimoMovimiento] = await Promise.all([
        prisma.scanRecord.findFirst({
          where: { discId: id, file: { status: 'committed' } },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: {
            tValue: true,
            hValue: true,
            rdValue: true,
            estadoCalculado: true,
          },
        }),
        prisma.inventoryMovement.findFirst({
          where: { brakeDiscId: id },
          orderBy: { createdAt: 'desc' },
          select: {
            tipo: true,
            fecha: true,
            encargadoNombre: true,
            supervisorNombre: true,
            numeroPt: true,
            justificacion: true,
          },
        }),
      ]);
      return [id, { ultimaMedicion, ultimoMovimiento }] as const;
    }),
  );
  const datosPorId = new Map(medicionesYMovimientos);

  function aLado(id: string): LadoInventario {
    const datos = datosPorId.get(id)!.ultimaMedicion;
    return {
      discoId: id,
      tValue: datos ? Number(datos.tValue) : null,
      hValue: datos ? Number(datos.hValue) : null,
      rdValue: datos ? datos.rdValue : null,
      estadoCalculado: datos?.estadoCalculado ?? null,
    };
  }

  const rows = clavesPagina.map((clave): InventoryRow => {
    const miembros = grupos.get(clave)!.map((d) => discoPorId.get(d.id)!);
    const izq = miembros.find((d) => d.lado === 'izquierdo') ?? null;
    const der = miembros.find((d) => d.lado === 'derecho') ?? null;
    // Cualquier disco del par sirve de "cabecera" para los campos
    // compartidos (serie/fase/lote/fabricante/marcaRueda/stage) — siempre
    // deberían coincidir entre lados (se escriben juntos), izq gana si por
    // algún motivo difieren.
    const cabecera = izq ?? der ?? miembros[0];

    const posicion: PosicionInventario | null =
      cabecera.stage === 'en_servicio' &&
      cabecera.wagonUnit &&
      cabecera.bogieCodigo &&
      cabecera.ejeNumero !== null
        ? {
            trenNumero: cabecera.wagonUnit.tren.numero,
            modeloVagon: cabecera.wagonUnit.tipoCoche,
            numeroCoche: cabecera.wagonUnit.numeroCoche,
            bogieCodigo: cabecera.bogieCodigo,
            ejeNumero: cabecera.ejeNumero,
          }
        : null;

    const movimientos = miembros
      .map((d) => datosPorId.get(d.id)!.ultimoMovimiento)
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    const ultimoMovimiento = movimientos[0] ?? null;

    return {
      clave,
      serie: cabecera.serie,
      stage: cabecera.stage,
      fase: cabecera.fase,
      lote: cabecera.lote,
      fabricante: cabecera.fabricante,
      marcaRueda: cabecera.marcaRueda,
      posicion,
      izquierdo: izq ? aLado(izq.id) : null,
      derecho: der ? aLado(der.id) : null,
      asociacion: resolverAsociacion(cabecera.stage, posicion),
      ultimoMovimiento: ultimoMovimiento
        ? {
            tipo: ultimoMovimiento.tipo,
            fecha: ultimoMovimiento.fecha.toISOString().slice(0, 10),
            encargadoNombre: ultimoMovimiento.encargadoNombre,
            supervisorNombre: ultimoMovimiento.supervisorNombre,
            numeroPt: ultimoMovimiento.numeroPt,
            justificacion: ultimoMovimiento.justificacion,
          }
        : null,
    };
  });

  return { rows, page: q.page, pageSize: q.pageSize, total, totalPages };
}

export async function obtenerStatsInventory(
  prisma: PrismaService,
): Promise<InventoryStats> {
  // Cuenta EJES, no discos individuales — izquierdo+derecho del mismo eje
  // son 1 sola pieza física (ver claveGrupo), así que un groupBy simple por
  // stage duplicaba el conteo x2 frente a lo que muestran las tablas de
  // Inventario/Operaciones (que sí están agrupadas por eje).
  const livianos = await prisma.brakeDisc.findMany({
    where: { activo: true },
    select: {
      id: true,
      serie: true,
      stage: true,
      wagonUnitId: true,
      bogieCodigo: true,
      ejeNumero: true,
    },
  });

  const porStage: InventoryStats = { almacen: 0, taller: 0, en_servicio: 0 };
  const clavesVistas = new Set<string>();
  for (const disco of livianos) {
    const clave = `${disco.stage}:${claveGrupo(disco)}`;
    if (clavesVistas.has(clave)) continue;
    clavesVistas.add(clave);
    porStage[disco.stage] += 1;
  }
  return porStage;
}
