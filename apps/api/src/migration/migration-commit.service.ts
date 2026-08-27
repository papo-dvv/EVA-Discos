import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ModuloSnapshot,
  Prisma,
  TipoCoche,
  type LadoDisco,
  type PosicionDisco,
  type ScanRecord,
} from '../../generated/prisma';
import { GenerarSnapshotService } from '../module-snapshot/generar-snapshot.service';
import { PrismaService } from '../prisma/prisma.service';
import { WearRateService } from '../wear-rate/wear-rate.service';
import { MigrationHistoryService } from './migration-history.service';
import {
  normalizarCoche,
  resolverLadoYPosicion,
} from './migration-excel.parser';

// Tamaño de lote y timeout de cada transacción corta de FASE 2. A este
// volumen (miles de filas) ninguna transacción única alcanza a terminar
// dentro del timeout global de Prisma (5000ms) — de ahí el rediseño completo
// en fases: ver comentario sobre `confirmar()` más abajo.
const TAMANO_LOTE = 500;
const TIMEOUT_LOTE_MS = 10_000;

export interface ResumenCommit {
  fileId: string;
  status: string;
  totalFilas: number;
  cochesResueltos: number;
  discosResueltos: number;
  lotesCompletados: number;
  lotesTotal: number;
}

export interface ResumenCancelacion {
  fileId: string;
  cancelado: boolean;
}

// Tipos de coche válidos (espejo del enum TipoCoche de la base).
const TIPOS_COCHE = new Set<string>(Object.values(TipoCoche));

// Reusa la MISMA normalización del parser (trim + mayúsculas + "R"/"R." ->
// "REM"): las filas que vienen de una carga ya llegan normalizadas, pero esto
// queda como defensa en profundidad para filas editadas a mano después
// (PATCH /migration/:fileId/rows/:rowId no fuerza esta regla).
function resolverTipoCoche(coche: string | null): TipoCoche | null {
  const v = normalizarCoche(coche);
  return v !== null && TIPOS_COCHE.has(v) ? (v as TipoCoche) : null;
}

function esViolacionUnicidad(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function enLotes<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano));
  }
  return lotes;
}

interface DiscoDescrito {
  numeroCoche: number;
  tipoCoche: TipoCoche;
  trenId: string;
  bogieCodigo: string;
  ejeNumero: number;
  lado: LadoDisco;
  posicion: PosicionDisco;
  ruedaNumero: number | null;
}

@Injectable()
export class MigrationCommitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wearRate: WearRateService,
    private readonly generarSnapshot: GenerarSnapshotService,
    private readonly history: MigrationHistoryService,
  ) {}

  // Confirmación final de la migración, rediseñada en dos fases para escalar
  // a miles de filas (ver prompt de corrección de P2028 "transaction
  // expired"): el diseño anterior hacía TODO — resolver/crear WagonUnit y
  // BrakeDisc por fila, más el update de cada ScanRecord — dentro de una
  // única transacción interactiva de Prisma con timeout de 5000ms. A partir
  // de ~cientos de filas ninguna optimización de queries evita el timeout:
  // el problema es el diseño "todo en una transacción", no una query lenta.
  //
  // FASE 1 (fuera de transacción larga): resuelve/crea WagonUnit y BrakeDisc
  // para cada fila aún pendiente (disc_id null), con upserts idempotentes
  // individuales — nunca una transacción que envuelva miles de filas. Si una
  // fila falla la resolución de catálogo, se aborta ANTES de tocar cualquier
  // ScanRecord o el status del archivo, así que el archivo queda exactamente
  // como estaba (review, editable) para corregir esa fila y reintentar. Los
  // coches/discos que sí se llegaron a crear para OTRAS filas antes del fallo
  // se conservan: son catálogo real y válido, y el próximo intento los
  // reutiliza (findUnique) en vez de duplicarlos.
  //
  // FASE 2 (lotes, cada uno su propia transacción corta): una vez resuelto
  // TODO el catálogo, recién ahí el archivo pasa a status 'committing' y se
  // asigna disc_id en lotes de TAMANO_LOTE filas, cada lote en su propia
  // transacción con timeout explícito (no el default de 5000ms para todo el
  // archivo). Si un lote falla, los lotes anteriores ya quedaron confirmados
  // (su transacción ya se cerró) y el archivo queda en 'committing' — un
  // estado intermedio explícito, distinto de 'committed' — listo para
  // reintentar: un segundo POST /migration/:fileId/commit vuelve a llamar a
  // este método, que retoma exactamente donde quedó (solo procesa filas con
  // disc_id todavía null), sin duplicar nada ya confirmado.
  //
  // Solo cuando TODOS los lotes terminan exitosamente se marca
  // uploaded_files.status = 'committed'.
  async confirmar(fileId: string, usuarioId: string): Promise<ResumenCommit> {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tipoCarga !== 'migracion_masiva_excel') {
      throw new NotFoundException('Carga de migración no encontrada.');
    }
    if (file.status === 'committed') {
      throw new ConflictException(
        'Esta carga ya fue confirmada en base de datos.',
      );
    }
    if (file.status !== 'review' && file.status !== 'committing') {
      throw new ConflictException('Esta carga no está lista para confirmarse.');
    }

    const totalFilas = await this.prisma.scanRecord.count({
      where: { fileId },
    });
    if (totalFilas === 0) {
      throw new UnprocessableEntityException(
        'La carga no tiene filas para confirmar.',
      );
    }

    // Catálogos de referencia (estáticos): trenes por número y códigos de
    // bogie válidos. Se resuelven una vez y se validan por fila.
    const trenes = await this.prisma.train.findMany({
      select: { id: true, numero: true },
    });
    const trenesPorNumero = new Map(trenes.map((t) => [t.numero, t.id]));

    const bogies = await this.prisma.bogieCatalog.findMany({
      select: { codigo: true },
    });
    const bogiesValidos = new Set(bogies.map((b) => b.codigo));

    // --- FASE 1: resolución de catálogo para las filas aún pendientes ---
    // En un reintento, las filas de lotes ya confirmados tienen disc_id no
    // nulo y no vuelven a pasar por acá: esto es lo que hace posible retomar
    // sin reprocesar todo desde cero.
    const pendientes = await this.prisma.scanRecord.findMany({
      where: { fileId, discId: null },
    });

    const cocheCache = new Map<number, string>();
    const discoCache = new Map<string, string>();
    const discIdPorFila = new Map<string, string>();
    let cochesCreados = 0;
    let discosCreados = 0;

    for (const r of pendientes) {
      const disco = this.describirDisco(r, trenesPorNumero, bogiesValidos);

      let wagonUnitId = cocheCache.get(disco.numeroCoche);
      if (!wagonUnitId) {
        const resuelto = await this.resolverWagonUnit(disco);
        wagonUnitId = resuelto.id;
        if (resuelto.creado) cochesCreados++;
        cocheCache.set(disco.numeroCoche, wagonUnitId);
      }

      const claveDisco = `${wagonUnitId}|${disco.bogieCodigo}|${disco.ejeNumero}|${disco.lado}|${disco.posicion}`;
      let discId = discoCache.get(claveDisco);
      if (!discId) {
        const resuelto = await this.resolverBrakeDisc(wagonUnitId, disco);
        discId = resuelto.id;
        if (resuelto.creado) discosCreados++;
        discoCache.set(claveDisco, discId);
      }

      discIdPorFila.set(r.id, discId);
    }

    // Recién ahora que TODO el catálogo quedó resuelto sin errores se reserva
    // el estado 'committing' y el total de lotes planeado (solo la primera
    // vez: en un reintento, ya están fijados desde el intento anterior).
    const lotesTotal =
      file.commitLotesTotal ?? Math.ceil(totalFilas / TAMANO_LOTE);
    if (file.status === 'review') {
      await this.prisma.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'committing',
          commitLotesTotal: lotesTotal,
          commitLotesCompletados: 0,
          commitError: null,
        },
      });
    }

    // --- FASE 2: asignación de disc_id en lotes, cada uno su transacción ---
    const lotes = enLotes(pendientes, TAMANO_LOTE);
    for (const lote of lotes) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await Promise.all(
              lote.map((r) =>
                tx.scanRecord.update({
                  where: { id: r.id },
                  data: { discId: discIdPorFila.get(r.id)! },
                }),
              ),
            );
            await tx.uploadedFile.update({
              where: { id: fileId },
              data: { commitLotesCompletados: { increment: 1 } },
            });
          },
          { timeout: TIMEOUT_LOTE_MS },
        );
      } catch (err) {
        const detalle = mensajeDeError(err);
        await this.prisma.uploadedFile
          .update({ where: { id: fileId }, data: { commitError: detalle } })
          .catch(() => undefined); // no ocultar el error real si esto también falla
        throw new UnprocessableEntityException(
          `No se pudo confirmar un lote de la migración: ${detalle}. ` +
            'Los lotes anteriores ya quedaron confirmados en base de datos; ' +
            'puedes reintentar la confirmación, que retomará desde este punto.',
        );
      }

      // Paso posterior a la resolución de disc_id de ESTE lote: recálculo
      // incremental de tasa de desgaste (WearRateModule) para los discos que
      // tocó. Deliberadamente FUERA de la transacción corta de arriba: son
      // más queries por disco (frontera + historial), y meterlas ahí
      // competiría por el mismo timeout ya ajustado para el problema
      // original de P2028 con miles de filas. El método es idempotente
      // (createMany con skipDuplicates), así que es seguro si el proceso
      // muere justo acá y el commit se reintenta.
      const discIdsDelLote = lote.map((r) => discIdPorFila.get(r.id)!);
      await this.wearRate.recalcularParaDiscos(discIdsDelLote);
    }

    // Todos los lotes terminaron: recién acá se marca 'committed'.
    const archivoFinal = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.uploadedFile.update({
        where: { id: fileId },
        data: {
          status: 'committed',
          commitLotesCompletados: lotesTotal,
          commitError: null,
        },
      });
      await tx.scanEditLog.create({
        data: {
          fileId,
          etapa: 'pre_commit',
          campoEditado: 'status_archivo',
          valorAnterior: file.status,
          valorNuevo: 'committed',
          usuarioId,
        },
      });
      await this.history.registrar(
        {
          tipo: 'migracion_confirmada',
          fileId,
          nombreArchivo: actualizado.filename,
          alcance: file.alcance,
          marca: file.marca,
          trenNumero: file.trenNumero,
          totalFilas: actualizado.totalRows,
          filasValidas: actualizado.validRows,
          filasInvalidas: actualizado.invalidRows,
          usuarioId,
        },
        tx,
      );
      return actualizado;
    });

    // Primer commit exitoso de la migración masiva: uno de los 2
    // disparadores automáticos del snapshot mensual (ver
    // SnapshotBootstrapService para el otro, "primer arranque del
    // proceso" — gana el que ocurra primero). Se llama SIEMPRE tras un
    // commit exitoso, no solo la vez que sea literalmente el primero: el
    // propio UNIQUE(modulo, mesAnio) de GenerarSnapshotService.generar hace
    // que los commits siguientes dentro del mismo mes sean no-ops. Mejor
    // esfuerzo — un fallo acá nunca debe convertir un commit ya exitoso en
    // un error de respuesta.
    await Promise.all([
      this.generarSnapshot
        .generar(ModuloSnapshot.trazabilidad)
        .catch(() => undefined),
      this.generarSnapshot
        .generar(ModuloSnapshot.proyeccion)
        .catch(() => undefined),
    ]);

    return {
      fileId,
      status: archivoFinal.status,
      totalFilas,
      cochesResueltos: cochesCreados,
      discosResueltos: discosCreados,
      lotesCompletados: lotesTotal,
      lotesTotal,
    };
  }

  // Cancela una carga en borrador: borra el UploadedFile y, en cascada
  // (onDelete: Cascade en schema.prisma), sus ScanRecord y ScanEditLog. Nunca
  // se puede cancelar una carga ya confirmada en base de datos — ahí ya hay
  // coches/discos reales creados, cancelar sería perder datos definitivos.
  async cancelar(
    fileId: string,
    usuarioId: string,
  ): Promise<ResumenCancelacion> {
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tipoCarga !== 'migracion_masiva_excel') {
      throw new NotFoundException('Carga de migración no encontrada.');
    }
    if (file.status === 'committed') {
      throw new ConflictException(
        'Esta carga ya fue confirmada en base de datos y no puede cancelarse.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.history.registrar(
        {
          tipo: 'migracion_cancelada',
          fileId,
          nombreArchivo: file.filename,
          alcance: file.alcance,
          marca: file.marca,
          trenNumero: file.trenNumero,
          totalFilas: file.totalRows,
          filasValidas: file.validRows,
          filasInvalidas: file.invalidRows,
          usuarioId,
        },
        tx,
      );
      await tx.uploadedFile.delete({ where: { id: fileId } });
    });

    return { fileId, cancelado: true };
  }

  // Busca el WagonUnit por número de coche (único global); si no existe lo
  // crea. Si otra llamada lo crea justo entre el findUnique y el create (P2002),
  // se re-consulta y se reutiliza en vez de fallar: "ya existe, seguir".
  //
  // Reasignación real de coches entre trenes (confirmado en el histórico
  // Ansaldo: el mismo N° de coche aparece bajo distintos trenes en fechas
  // distintas — no es ruido de datos). Si el WagonUnit ya existe pero con
  // otro trenId/tipoCoche, se actualiza al de esta migración: cada commit
  // representa un snapshot más reciente que el anterior, así que "el último
  // que se confirma" gana. No condicionado a fabricante: para Alstom es un
  // no-op porque nunca hay reasignación en los datos reales.
  private async resolverWagonUnit(
    disco: DiscoDescrito,
  ): Promise<{ id: string; creado: boolean }> {
    const existente = await this.prisma.wagonUnit.findUnique({
      where: { numeroCoche: disco.numeroCoche },
    });
    if (existente) {
      if (
        existente.trenId !== disco.trenId ||
        existente.tipoCoche !== disco.tipoCoche
      ) {
        const actualizado = await this.prisma.wagonUnit.update({
          where: { id: existente.id },
          data: { trenId: disco.trenId, tipoCoche: disco.tipoCoche },
        });
        return { id: actualizado.id, creado: false };
      }
      return { id: existente.id, creado: false };
    }

    try {
      const creado = await this.prisma.wagonUnit.create({
        data: {
          numeroCoche: disco.numeroCoche,
          tipoCoche: disco.tipoCoche,
          trenId: disco.trenId,
        },
      });
      return { id: creado.id, creado: true };
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        const existenteAhora = await this.prisma.wagonUnit.findUnique({
          where: { numeroCoche: disco.numeroCoche },
        });
        if (existenteAhora) return { id: existenteAhora.id, creado: false };
      }
      throw err;
    }
  }

  // Misma lógica de "buscar, crear, y si choca por unicidad reusar" para el
  // BrakeDisc, identificado por (wagonUnitId, bogieCodigo, ejeNumero, lado).
  private async resolverBrakeDisc(
    wagonUnitId: string,
    disco: DiscoDescrito,
  ): Promise<{ id: string; creado: boolean }> {
    const clave = {
      wagonUnitId,
      bogieCodigo: disco.bogieCodigo,
      ejeNumero: disco.ejeNumero,
      lado: disco.lado,
      posicion: disco.posicion,
    };
    const existente = await this.prisma.brakeDisc.findUnique({
      where: { wagonUnitId_bogieCodigo_ejeNumero_lado_posicion: clave },
    });
    if (existente) return { id: existente.id, creado: false };

    try {
      const creado = await this.prisma.brakeDisc.create({
        // Un BrakeDisc resuelto/creado por la migración masiva SIEMPRE
        // representa una pieza ya montada (viene del histórico físico real
        // de la flota), nunca stock nuevo de Inventario — de ahí
        // en_servicio/usada explícitos (no hay @default en el schema).
        // serie: el Excel histórico nunca trae un número de serie de fábrica
        // para estas piezas — se marca como MIG-xxxxxxxx (en vez de dejarla
        // null) para que Inventario siempre tenga algo que mostrar/buscar;
        // ver también el backfill de altas antiguas en prisma/seed.ts.
        data: {
          ...clave,
          ruedaNumero: disco.ruedaNumero,
          stage: 'en_servicio',
          fase: 'usada',
          serie: `MIG-${randomUUID().slice(0, 8).toUpperCase()}`,
        },
      });
      return { id: creado.id, creado: true };
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        const existenteAhora = await this.prisma.brakeDisc.findUnique({
          where: { wagonUnitId_bogieCodigo_ejeNumero_lado_posicion: clave },
        });
        if (existenteAhora) return { id: existenteAhora.id, creado: false };
      }
      throw err;
    }
  }

  // Valida y normaliza la identidad cruda del disco. Cualquier dato de
  // catálogo que no resuelva lanza 422 y aborta la confirmación ANTES de
  // tocar ScanRecord o el status del archivo (ver comentario de `confirmar`).
  private describirDisco(
    r: ScanRecord,
    trenesPorNumero: Map<number, string>,
    bogiesValidos: Set<string>,
  ): DiscoDescrito {
    const trenId = trenesPorNumero.get(r.trenNumero);
    if (!trenId) {
      throw this.errorFila(
        r,
        `el tren ${r.trenNumero} no existe en el catálogo`,
      );
    }

    if (r.numeroCocheExcel === null) {
      throw this.errorFila(r, 'falta el número de coche');
    }
    const tipoCoche = resolverTipoCoche(r.cocheExcel);
    if (!tipoCoche) {
      throw this.errorFila(
        r,
        `tipo de coche inválido (${r.cocheExcel ?? 'vacío'})`,
      );
    }

    const bogieCodigo = (r.bogieExcel ?? '').trim();
    if (!bogiesValidos.has(bogieCodigo)) {
      throw this.errorFila(r, `bogie inválido (${r.bogieExcel ?? 'vacío'})`);
    }

    if (r.ejeExcel === null) {
      throw this.errorFila(r, 'falta el eje');
    }

    const { lado, posicion } = resolverLadoYPosicion(
      r.ubicacionExcel,
      r.ruedaExcel,
    );
    if (!lado) {
      throw this.errorFila(
        r,
        `no se pudo determinar el lado (ubicación "${r.ubicacionExcel ?? 'vacío'}")`,
      );
    }

    return {
      numeroCoche: r.numeroCocheExcel,
      tipoCoche,
      trenId,
      bogieCodigo,
      ejeNumero: r.ejeExcel,
      lado,
      posicion,
      ruedaNumero: r.ruedaExcel,
    };
  }

  private errorFila(
    r: ScanRecord,
    detalle: string,
  ): UnprocessableEntityException {
    const origen = r.hojaExcelOrigen ? `hoja ${r.hojaExcelOrigen}, ` : '';
    return new UnprocessableEntityException(
      `No se pudo confirmar la migración: ${origen}${detalle}. ` +
        'No se guardó ningún cambio.',
    );
  }
}
