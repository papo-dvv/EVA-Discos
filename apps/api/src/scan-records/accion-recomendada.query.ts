import { Prisma, type BrakeDisc, type LadoDisco } from '../../generated/prisma';
import type {
  AccionRecomendada,
  BrakeDiscRulesEngine,
  LadoAfectado,
  MedicionDisco,
  ResultadoAccionRecomendada,
} from '../brake-disc-rules/brake-disc-rules.engine';
import { resolverLado } from '../migration/migration-excel.parser';
import type { PrismaService } from '../prisma/prisma.service';
import type { PreviewRow } from './scan-record-query';

// Enriquece PreviewRow.accionRecomendada/ladoAfectado (ver evaluarAccionRecomendada,
// BrakeDiscRulesModule) para las 2 vistas de listado que lo exponen:
// MigrationPreviewService.obtenerPreview (borrador, acotado a un fileId) y
// ScanRecordsService.buscar (confirmados, vía BrakeDisc). Es una propiedad DEL
// EJE (coche+bogie+eje), no de la fila individual: toda fila que comparta esa
// identidad —de cualquier lado, de cualquier fecha— recibe el MISMO valor,
// calculado siempre con la medición más reciente disponible de cada lado.
// Deliberadamente NO vive en scan-record-query.ts: ese archivo es un
// WHERE/paginación/mapeo genérico; esto es lógica de negocio de cruce que
// solo tiene sentido en el contexto de cada vista (borrador vs. confirmado).

// Mismo criterio de "más reciente" en ambos lados: fecha desc y, si empata,
// kilometraje desc (un odómetro mayor es fisicamente posterior aunque la
// fecha coincida) y por último id desc, solo para que el resultado sea
// determinístico ante un triple empate.
// Exportada: Proyección (ProyeccionCalculatorService) también necesita "la
// medición confirmada más reciente de un disco", el mismo criterio exacto
// que ya usa resolverAccionPorDiscId más abajo.
export const ORDEN_MAS_RECIENTE: Prisma.ScanRecordOrderByWithRelationInput[] = [
  { fecha: 'desc' },
  { kilometraje: 'desc' },
  { id: 'desc' },
];

// PreviewRow ya NO expone accionRecomendada/ladoAfectado (se quitaron de la
// serialización de Migración preview y Mediciones confirmadas — ver
// MigrationPreviewService.obtenerPreview / ScanRecordsService.buscar): este
// tipo propio reemplaza al viejo Pick<PreviewRow, ...> para que estas
// funciones (sin llamadores hoy, conservadas por si se recalibran) sigan
// compilando sin depender de esos 2 campos.
export interface FilaConAccionRecomendada {
  accionRecomendada: AccionRecomendada | null;
  ladoAfectado: LadoAfectado;
}

function accionOrNull(
  resultado: ResultadoAccionRecomendada | null | undefined,
): FilaConAccionRecomendada {
  return {
    accionRecomendada: resultado?.accion ?? null,
    ladoAfectado: resultado?.ladoAfectado ?? null,
  };
}

// ---------------------------------------------------------------------------
// Borrador (MigrationPreviewService.obtenerPreview) — sin disco resuelto
// todavía: la identidad del eje es la cruda del Excel (numeroCocheExcel +
// bogieExcel + ejeExcel) y el lado se deriva por fila con resolverLado.
// ---------------------------------------------------------------------------

interface IdentidadDraft {
  numeroCocheExcel: number | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
}

function claveEjeDraft(f: IdentidadDraft): string | null {
  const bogie = f.bogieExcel?.trim();
  if (f.numeroCocheExcel === null || !bogie || f.ejeExcel === null) {
    return null;
  }
  return `${f.numeroCocheExcel}|${bogie}|${f.ejeExcel}`;
}

export async function enriquecerAccionRecomendadaDraft(
  prisma: PrismaService,
  fileId: string,
  filas: PreviewRow[],
  evaluador: BrakeDiscRulesEngine,
): Promise<(PreviewRow & FilaConAccionRecomendada)[]> {
  const identidades = new Map<string, IdentidadDraft>();
  for (const f of filas) {
    const clave = claveEjeDraft(f);
    if (clave && !identidades.has(clave)) {
      identidades.set(clave, {
        numeroCocheExcel: f.numeroCocheExcel,
        bogieExcel: f.bogieExcel!.trim(),
        ejeExcel: f.ejeExcel,
      });
    }
  }
  if (identidades.size === 0) {
    return filas.map((f) => ({ ...f, ...accionOrNull(null) }));
  }

  // Un único query: TODAS las filas de este fileId que comparten alguna de
  // las identidades presentes en esta página (nunca el archivo completo).
  const candidatos = await prisma.scanRecord.findMany({
    where: {
      fileId,
      OR: [...identidades.values()].map((c) => ({
        numeroCocheExcel: c.numeroCocheExcel,
        bogieExcel: c.bogieExcel,
        ejeExcel: c.ejeExcel,
      })),
    },
    select: {
      numeroCocheExcel: true,
      bogieExcel: true,
      ejeExcel: true,
      ubicacionExcel: true,
      ruedaExcel: true,
      hValue: true,
      rdValue: true,
    },
    orderBy: ORDEN_MAS_RECIENTE,
  });

  // Ya viene ordenado más-reciente-primero: la primera aparición de cada lado
  // POR IDENTIDAD es, por construcción, su medición más reciente.
  const masRecientePorEje = new Map<
    string,
    Partial<Record<LadoDisco, MedicionDisco>>
  >();
  for (const c of candidatos) {
    const clave = claveEjeDraft(c);
    if (!clave) continue;
    const lado = resolverLado(c.ubicacionExcel, c.ruedaExcel);
    if (!lado) continue;

    const lados = masRecientePorEje.get(clave) ?? {};
    if (!lados[lado]) {
      lados[lado] = { h: Number(c.hValue), rd: c.rdValue };
      masRecientePorEje.set(clave, lados);
    }
  }

  const accionPorEje = new Map<string, ResultadoAccionRecomendada | null>();
  for (const [clave, lados] of masRecientePorEje) {
    accionPorEje.set(
      clave,
      lados.izquierdo && lados.derecho
        ? evaluador.evaluarAccionRecomendada(lados.izquierdo, lados.derecho)
        : null,
    );
  }

  return filas.map((f) => {
    const clave = claveEjeDraft(f);
    const resultado = clave ? accionPorEje.get(clave) : null;
    return { ...f, ...accionOrNull(resultado) };
  });
}

// ---------------------------------------------------------------------------
// Confirmado (ScanRecordsService.buscar) — disco ya resuelto: la identidad
// del eje es (wagonUnitId, bogieCodigo, ejeNumero) y el lado es el enum real
// de BrakeDisc, sin derivar nada.
// ---------------------------------------------------------------------------

function claveEjeConfirmado(d: {
  wagonUnitId: string;
  bogieCodigo: string;
  ejeNumero: number;
}): string {
  return `${d.wagonUnitId}|${d.bogieCodigo}|${d.ejeNumero}`;
}

function ladoOpuesto(l: LadoDisco): LadoDisco {
  return l === 'izquierdo' ? 'derecho' : 'izquierdo';
}

// Núcleo compartido de la resolución "confirmada": dado un conjunto de
// discId, devuelve la acción recomendada de CADA UNO (indexado por discId).
// Reutilizado por enriquecerAccionRecomendadaConfirmado (ScanRecordsService,
// vía PreviewRow.discId) y por WearRateService (vía WearRatePair.discId) —
// ambos tienen la misma identidad de disco, solo difieren en la forma de la
// fila que envuelve a ese discId.
export async function resolverAccionPorDiscId(
  prisma: PrismaService,
  discIdsPropios: string[],
  evaluador: BrakeDiscRulesEngine,
): Promise<Map<string, ResultadoAccionRecomendada | null>> {
  const accionPorDisco = new Map<string, ResultadoAccionRecomendada | null>();
  if (discIdsPropios.length === 0) return accionPorDisco;

  // stage: 'en_servicio' — "acción recomendada" compara ambos lados de un
  // eje FÍSICO montado ahora mismo; una pieza retirada a almacén/taller (ver
  // Operaciones) ya no tiene una posición real con la que emparejarse.
  const discosPropios = await prisma.brakeDisc.findMany({
    where: { id: { in: discIdsPropios }, stage: 'en_servicio' },
  });
  if (discosPropios.length === 0) return accionPorDisco;

  // Disco "par" de cada uno: mismo wagonUnitId+bogieCodigo+ejeNumero, lado
  // opuesto. No siempre existe (nunca se creó un disco para ese lado).
  const discosPar = await prisma.brakeDisc.findMany({
    where: {
      stage: 'en_servicio',
      OR: discosPropios.map((d) => ({
        wagonUnitId: d.wagonUnitId,
        bogieCodigo: d.bogieCodigo,
        ejeNumero: d.ejeNumero,
        lado: ladoOpuesto(d.lado!),
      })),
    },
  });

  const discoPorId = new Map<string, BrakeDisc>();
  for (const d of [...discosPropios, ...discosPar]) discoPorId.set(d.id, d);

  // Un solo grupo por eje (wagonUnitId+bogieCodigo+ejeNumero), con AMBOS
  // discos si existen. wagonUnitId/bogieCodigo/ejeNumero/lado no-null
  // garantizados por el where (stage: 'en_servicio') de ambas queries de
  // arriba — Prisma no lo refleja en el tipo generado.
  const gruposPorEje = new Map<string, Partial<Record<LadoDisco, BrakeDisc>>>();
  for (const disco of discoPorId.values()) {
    const clave = claveEjeConfirmado({
      wagonUnitId: disco.wagonUnitId!,
      bogieCodigo: disco.bogieCodigo!,
      ejeNumero: disco.ejeNumero!,
    });
    const grupo = gruposPorEje.get(clave) ?? {};
    grupo[disco.lado!] = disco;
    gruposPorEje.set(clave, grupo);
  }

  // Medición CONFIRMADA más reciente por disco — acotado a los discos
  // realmente necesarios (nunca toda la flota). N+1 deliberado: el volumen
  // está acotado por cuántos discId distintos haya en `discIdsPropios` × 2
  // lados, no por el tamaño de scan_records.
  const discIdsNecesarios = [...discoPorId.keys()];
  const masRecientePorDisco = new Map<string, MedicionDisco>();
  await Promise.all(
    discIdsNecesarios.map(async (discId) => {
      const masReciente = await prisma.scanRecord.findFirst({
        where: { discId },
        orderBy: ORDEN_MAS_RECIENTE,
        select: { hValue: true, rdValue: true },
      });
      if (masReciente) {
        masRecientePorDisco.set(discId, {
          h: Number(masReciente.hValue),
          rd: masReciente.rdValue,
        });
      }
    }),
  );

  for (const grupo of gruposPorEje.values()) {
    const medIzq =
      grupo.izquierdo && masRecientePorDisco.get(grupo.izquierdo.id);
    const medDer = grupo.derecho && masRecientePorDisco.get(grupo.derecho.id);
    const resultado =
      medIzq && medDer
        ? evaluador.evaluarAccionRecomendada(medIzq, medDer)
        : null;
    if (grupo.izquierdo) accionPorDisco.set(grupo.izquierdo.id, resultado);
    if (grupo.derecho) accionPorDisco.set(grupo.derecho.id, resultado);
  }

  return accionPorDisco;
}

export async function enriquecerAccionRecomendadaConfirmado(
  prisma: PrismaService,
  filas: PreviewRow[],
  evaluador: BrakeDiscRulesEngine,
): Promise<(PreviewRow & FilaConAccionRecomendada)[]> {
  const discIdsPropios = [
    ...new Set(
      filas.map((f) => f.discId).filter((id): id is string => id !== null),
    ),
  ];
  const accionPorDisco = await resolverAccionPorDiscId(
    prisma,
    discIdsPropios,
    evaluador,
  );

  return filas.map((f) => {
    const resultado = f.discId ? accionPorDisco.get(f.discId) : null;
    return { ...f, ...accionOrNull(resultado) };
  });
}

// Filtra filas YA enriquecidas por una lista de acciones permitidas y pagina
// el resultado EN MEMORIA — necesario porque accionRecomendada nunca es una
// columna de base de datos (se calcula cruzando discos), así que no existe un
// WHERE que lo exprese: hay que enriquecer TODO el conjunto que matchea el
// resto de filtros antes de poder saber cuántas filas hay y cuáles
// corresponden a esta página. Usado por MigrationPreviewService,
// ScanRecordsService y WearRateService cuando `accionRecomendada` viene en el
// query — el camino normal (sin ese filtro) sigue paginando en la base de
// datos, sin este costo.
// `obtenerAccion` (en vez de exigir un campo `accionRecomendada` fijo en T):
// PreviewRow ya trae ese campo para mostrarlo, pero FilaWearRateApi no lo
// expone en absoluto (ver WearRateService.buscarPares) — así cada llamador
// decide de dónde sale la acción sin forzar una forma de fila compartida.
export function paginarFiltrandoPorAccion<T>(
  filas: T[],
  obtenerAccion: (fila: T) => AccionRecomendada | null,
  accionesPermitidas: AccionRecomendada[],
  page: number,
  pageSize: number,
): { rows: T[]; total: number; totalPages: number } {
  const filtradas = filas.filter((f) => {
    const accion = obtenerAccion(f);
    return accion !== null && accionesPermitidas.includes(accion);
  });
  const total = filtradas.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const inicio = (page - 1) * pageSize;
  return {
    rows: filtradas.slice(inicio, inicio + pageSize),
    total,
    totalPages,
  };
}
