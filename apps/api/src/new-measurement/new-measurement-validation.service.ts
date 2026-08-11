import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LadoDisco, ScanRecord, TipoCoche } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

// Validación cruzada automática de una ficha de medición individual en
// borrador (motivo 'Medición' únicamente) contra el historial YA CONFIRMADO
// (scan_records.disc_id no nulo — mismo criterio que SOLO_CONFIRMADOS en
// scan-records.service.ts). Dos niveles de comparación:
//   - Km/Fecha: a nivel FICHA/TREN, contra la medición confirmada más
//     reciente de CUALQUIER disco de ese tren.
//   - T/Rd: por DISCO físico individual, contra la medición confirmada más
//     reciente de ESE MISMO disco (identidad resuelta por Tren+Coche+Bogie+
//     Eje+Lado, igual que NewMeasurementCommitService, pero sin lanzar si el
//     catálogo no resuelve: acá un disco no encontrado simplemente no tiene
//     referencia contra la cual comparar, no es un error).
@Injectable()
export class NewMeasurementValidationService {
  constructor(private readonly prisma: PrismaService) {}

  // Recalcula y persiste los 4 flags (kmInvalido/fechaInvalido/tInvalido/
  // rdInvalido) de TODAS las filas de la ficha, sin tocar excluidaDelCommit
  // ni measurement_sheet.verificado — usado al terminar de crear la ficha
  // (carga CSV o cada fila agregada en modo manual) y como primer paso de
  // verificar().
  async recalcularFlags(fichaId: string): Promise<FilaValidada[]> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }
    if (!ficha.uploadedFileId) return [];
    const esReperfilado = ficha.motivo === 'Reperfilado';

    const [filas, tren] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId: ficha.uploadedFileId },
      }),
      this.prisma.train.findUnique({ where: { numero: ficha.trenNumero } }),
    ]);
    if (filas.length === 0) return [];

    const referenciaTren = await this.prisma.scanRecord.findFirst({
      where: { trenNumero: ficha.trenNumero, discId: { not: null } },
      orderBy: [{ fecha: 'desc' }, { kilometraje: 'desc' }, { id: 'desc' }],
    });
    const kmInvalido =
      referenciaTren !== null &&
      Number(ficha.kilometraje) < Number(referenciaTren.kilometraje);
    const fechaInvalido =
      referenciaTren !== null &&
      ficha.fechaFicha.getTime() < referenciaTren.fecha.getTime();

    const wagonCache = new Map<string, string | null>();
    const flagsPorFila = await Promise.all(
      filas.map(async (fila) => {
        const raCalculada = Number(fila.tValue) - Number(fila.hValue);
        const discId = tren
          ? await this.resolverDiscIdSilencioso(tren.id, fila, wagonCache)
          : null;
        const referenciaDisco = discId
          ? await this.prisma.scanRecord.findFirst({
              where: { discId },
              orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
            })
          : null;
        const tInvalido =
          referenciaDisco !== null &&
          Number(fila.tValue) > Number(referenciaDisco.tValue);
        const rdInvalido =
          !esReperfilado && referenciaDisco !== null && fila.rdValue > referenciaDisco.rdValue;
        const rugosidadInvalida =
          esReperfilado &&
          (raCalculada < 0 ||
            raCalculada > 3.2 ||
            Number(fila.hValue) > 2 ||
            Number(fila.tValue) <= 0.3);

        return {
          id: fila.id,
          cocheExcel: fila.cocheExcel,
          ejeExcel: fila.ejeExcel,
          ubicacionExcel: fila.ubicacionExcel,
          kmInvalido,
          fechaInvalido,
          tInvalido,
          rdInvalido,
          rugosidadInvalida,
          raCalculada,
        };
      }),
    );

    await this.prisma.$transaction(
      flagsPorFila.map((f) =>
        this.prisma.scanRecord.update({
          where: { id: f.id },
          data: {
            kmInvalido: f.kmInvalido,
            fechaInvalido: f.fechaInvalido,
            tInvalido: f.tInvalido,
            rdInvalido: f.rdInvalido,
            ...(esReperfilado ? { rugosidadRa: f.raCalculada } : {}),
          },
        }),
      ),
    );

    return flagsPorFila;
  }

  // POST .../validate ("Verificar"): re-evalúa el estado ACTUAL de cada fila
  // (por si el usuario ya corrigió algo) y marca excluidaDelCommit=true en
  // toda fila que SIGA con algún flag activo — sin borrarla, sigue visible en
  // la tabla con su alerta. measurement_sheet.verificado pasa a true recién
  // acá: es lo único que habilita POST .../lock.
  async verificar(fichaId: string): Promise<ResumenVerificacion> {
    const filas = await this.recalcularFlags(fichaId);

    const actualizaciones = filas.map((f) =>
      this.prisma.scanRecord.update({
        where: { id: f.id },
        data: { excluidaDelCommit: esInvalida(f) },
      }),
    );

    await this.prisma.$transaction([
      ...actualizaciones,
      this.prisma.measurementSheet.update({
        where: { id: fichaId },
        data: { verificado: true },
      }),
    ]);

    const filasExcluidas: FilaExcluida[] = filas
      .filter(esInvalida)
      .map((f) => ({
        id: f.id,
        cocheExcel: f.cocheExcel,
        ejeExcel: f.ejeExcel,
        ubicacionExcel: f.ubicacionExcel,
        motivos: [
          f.kmInvalido ? 'kilometraje' : null,
          f.fechaInvalido ? 'fecha' : null,
          f.tInvalido ? 't' : null,
          f.rdInvalido ? 'rd' : null,
          f.rugosidadInvalida ? 'límites de reperfilado (T > 0.3, H ≤ 2.0, Ra ≤ 3.2)' : null,
        ].filter((m): m is string => m !== null),
      }));

    return {
      todoValido: filasExcluidas.length === 0,
      filasExcluidas,
      filasIncluidas: filas.length - filasExcluidas.length,
    };
  }

  // POST .../lock ("Bloquear Mediciones"): exige una verificación fresca
  // (verificado=true, sin ediciones posteriores — ver reseteoVerificado en
  // NewMeasurementPreviewService). No hay endpoint de desbloqueo todavía.
  async bloquear(fichaId: string): Promise<ResumenBloqueo> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }
    if (!ficha.verificado) {
      throw new UnprocessableEntityException(
        'Debes verificar la ficha (POST .../validate) sin ediciones posteriores antes de poder bloquear la tabla de mediciones.',
      );
    }

    await this.prisma.measurementSheet.update({
      where: { id: fichaId },
      data: { tablaBloqueada: true },
    });

    return { fichaId, tablaBloqueada: true };
  }

  private async resolverDiscIdSilencioso(
    trenId: string,
    fila: Pick<
      ScanRecord,
      'cocheExcel' | 'bogieExcel' | 'ejeExcel' | 'ubicacionExcel'
    >,
    wagonCache: Map<string, string | null>,
  ): Promise<string | null> {
    if (
      !fila.cocheExcel ||
      !fila.bogieExcel ||
      fila.ejeExcel === null ||
      !fila.ubicacionExcel
    ) {
      return null;
    }

    let wagonId = wagonCache.get(fila.cocheExcel);
    if (wagonId === undefined) {
      const wagon = await this.prisma.wagonUnit.findFirst({
        where: { trenId, tipoCoche: fila.cocheExcel as TipoCoche },
      });
      wagonId = wagon?.id ?? null;
      wagonCache.set(fila.cocheExcel, wagonId);
    }
    if (!wagonId) return null;

    const disco = await this.prisma.brakeDisc.findUnique({
      where: {
        wagonUnitId_bogieCodigo_ejeNumero_lado: {
          wagonUnitId: wagonId,
          bogieCodigo: fila.bogieExcel,
          ejeNumero: fila.ejeExcel,
          lado: fila.ubicacionExcel as LadoDisco,
        },
      },
    });
    return disco?.id ?? null;
  }
}

export interface FilaValidada {
  id: string;
  cocheExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  kmInvalido: boolean;
  fechaInvalido: boolean;
  tInvalido: boolean;
  rdInvalido: boolean;
  rugosidadInvalida: boolean;
  raCalculada: number;
}

export interface FilaExcluida {
  id: string;
  cocheExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  motivos: string[];
}

export interface ResumenVerificacion {
  todoValido: boolean;
  filasExcluidas: FilaExcluida[];
  filasIncluidas: number;
}

export interface ResumenBloqueo {
  fichaId: string;
  tablaBloqueada: boolean;
}

function esInvalida(f: {
  kmInvalido: boolean;
  fechaInvalido: boolean;
  tInvalido: boolean;
  rdInvalido: boolean;
  rugosidadInvalida: boolean;
}): boolean {
  return f.kmInvalido || f.fechaInvalido || f.tInvalido || f.rdInvalido || f.rugosidadInvalida;
}
