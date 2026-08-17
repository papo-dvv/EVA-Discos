import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LadoDisco, ScanRecord, TipoCoche } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  motivosInvalidosDeFila,
  ORDEN_FISICO_DEFECTO,
  TEXTO_MOTIVO_INVALIDO,
  type MotivoInvalido,
} from '../scan-records/scan-record-query';

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
  // rdInvalido) de TODAS las filas de la ficha, sin tocar
  // measurement_sheet.verificado — usado al terminar de crear la ficha
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

    // orderBy: mismo criterio jerárquico ya usado en toda la pantalla (ver
    // ORDEN_FISICO_DEFECTO) — así filasExcluidas de verificar() sale
    // pre-ordenado, sin que el frontend tenga que reordenar nada.
    const [filas, tren] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId: ficha.uploadedFileId },
        orderBy: ORDEN_FISICO_DEFECTO,
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
          referenciaDisco !== null && fila.rdValue > referenciaDisco.rdValue;

        return {
          id: fila.id,
          cocheExcel: fila.cocheExcel,
          ejeExcel: fila.ejeExcel,
          ubicacionExcel: fila.ubicacionExcel,
          kmInvalido,
          fechaInvalido,
          tInvalido,
          rdInvalido,
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
          },
        }),
      ),
    );

    return flagsPorFila;
  }

  // POST .../validate ("Verificar"): re-evalúa el estado ACTUAL de cada fila
  // (por si el usuario ya corrigió algo). El modelo es BINARIO: todoValido
  // solo es true cuando NINGUNA fila tiene un problema propio (t/rd) Y la
  // ficha no tiene un problema de km/fecha — no existe un camino de "commit
  // parcial saltando filas inválidas" (ver NewMeasurementCommitService.
  // confirmar, que ahora siempre procesa TODAS las filas). measurement_sheet.
  // verificado se fija en ESE MISMO valor (nunca incondicional a true): es lo
  // único que habilita POST .../lock, así que un problema pendiente (de
  // cualquiera de los 4 tipos) sigue bloqueando el bloqueo tras un /validate.
  async verificar(fichaId: string): Promise<ResumenVerificacion> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha) {
      throw new NotFoundException('Ficha de medición no encontrada.');
    }

    const filas = await this.recalcularFlags(fichaId);
    const alertasReperfilado =
      ficha.motivo === 'Reperfilado'
        ? await this.validarReperfilado(ficha.uploadedFileId)
        : [];

    // filas ya viene ordenado por ORDEN_FISICO_DEFECTO (ver recalcularFlags):
    // .filter() preserva ese orden, así que filasExcluidas sale pre-ordenado
    // sin necesidad de un sort aparte acá. Solo lista problemas POR FILA
    // (t/rd) — kmInvalido/fechaInvalido son a nivel ficha y NUNCA se
    // duplican acá (ver motivosInvalidosDeFila en scan-record-query.ts).
    const filasExcluidas: FilaExcluida[] = filas
      .filter(esInvalida)
      .map((f) => ({
        recordId: f.id,
        eje: f.ejeExcel,
        lado: f.ubicacionExcel,
        motivos: motivosInvalidosDeFila(f),
      }));

    // kmInvalido/fechaInvalido son a nivel FICHA/TREN: recalcularFlags les
    // asigna el MISMO valor a las 4 filas (ver comentario ahí), así que con
    // al menos una fila alcanza para leerlo — sin filas no hay nada que
    // reportar todavía.
    const primeraFila = filas[0];
    const kmInvalido = primeraFila?.kmInvalido ?? false;
    const fechaInvalido = primeraFila?.fechaInvalido ?? false;
    const todoValido =
      filasExcluidas.length === 0 &&
      !kmInvalido &&
      !fechaInvalido &&
      alertasReperfilado.length === 0;

    await this.prisma.measurementSheet.update({
      where: { id: fichaId },
      data: { verificado: todoValido },
    });

    return {
      todoValido,
      filasExcluidas,
      filasIncluidas: filas.length - filasExcluidas.length,
      kmInvalido: kmInvalido
        ? { motivo: TEXTO_MOTIVO_INVALIDO.kilometraje }
        : null,
      fechaInvalido: fechaInvalido
        ? { motivo: TEXTO_MOTIVO_INVALIDO.fecha }
        : null,
      alertasReperfilado,
    };
  }

  private async validarReperfilado(
    fileId: string | null,
  ): Promise<string[]> {
    if (!fileId) return ['La ficha no tiene una carga de mediciones asociada.'];
    const filas = await this.prisma.scanRecord.findMany({ where: { fileId } });
    const alertas: string[] = [];
    if (filas.length === 0)
      alertas.push('Ingresa al menos una posición medida antes de validar.');
    const contar = (predicado: (fila: ScanRecord) => boolean) =>
      filas.filter(predicado).length;
    const antesEspesor = contar((fila) => fila.reperfiladoTAntes !== null && Number(fila.reperfiladoTAntes) <= 0);
    const antesConcavo = contar((fila) => fila.reperfiladoHAntes !== null && Number(fila.reperfiladoHAntes) > 2);
    const despuesEspesor = contar((fila) => Number(fila.tValue) <= 0.3);
    const despuesConcavo = contar((fila) => Number(fila.hValue) > 2);
    const rugosidad = contar((fila) => fila.rugosidadRa !== null && Number(fila.rugosidadRa) !== 2.5);
    if (antesEspesor) alertas.push(`${antesEspesor} posición(es) tienen espesor anterior ≤ 0 mm.`);
    if (antesConcavo) alertas.push(`${antesConcavo} posición(es) tienen cóncavo anterior > 2,0 mm.`);
    if (despuesEspesor) alertas.push(`${despuesEspesor} posición(es) tienen espesor posterior ≤ 0,3 mm.`);
    if (despuesConcavo) alertas.push(`${despuesConcavo} posición(es) tienen cóncavo posterior > 2,0 mm.`);
    if (rugosidad) alertas.push(`${rugosidad} posición(es) no tienen la rugosidad final R.A. requerida de 2,5 µm.`);
    return alertas;
  }

  // Lee (sin recalcular) los flags kmInvalido/fechaInvalido YA PERSISTIDOS de
  // la ficha — usado por GET .../preview para exponerlos a nivel RAÍZ (nunca
  // por fila, ver motivosInvalidosDeFila) sin correr todo el pipeline de
  // recalcularFlags (que además escribe en la base) solo para una lectura.
  // Mismo criterio que verificar(): con una sola fila alcanza, las ~48
  // comparten el mismo valor.
  async obtenerFlagsRaiz(fichaId: string): Promise<FlagsFichaNivelRaiz> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
    });
    if (!ficha?.uploadedFileId) {
      return { kmInvalido: null, fechaInvalido: null };
    }
    const primeraFila = await this.prisma.scanRecord.findFirst({
      where: { fileId: ficha.uploadedFileId },
      select: { kmInvalido: true, fechaInvalido: true },
    });
    return {
      kmInvalido: primeraFila?.kmInvalido
        ? { motivo: TEXTO_MOTIVO_INVALIDO.kilometraje }
        : null,
      fechaInvalido: primeraFila?.fechaInvalido
        ? { motivo: TEXTO_MOTIVO_INVALIDO.fecha }
        : null,
    };
  }

  // POST .../lock ("Bloquear Mediciones"): exige una verificación fresca
  // (verificado=true, sin ediciones posteriores — ver reseteoVerificado en
  // NewMeasurementPreviewService) Y el P.T. (Puesto de Trabajo) completo —
  // mismo nivel de obligatoriedad que verificado=true, ver
  // NewMeasurementCommitService.confirmar para el mismo requisito en el
  // commit final. No hay endpoint de desbloqueo todavía.
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
    const puestoIncompleto =
      ficha.motivo === 'Reperfilado'
        ? !ficha.puestoTrabajo?.trim() ||
          !ficha.fechaHoraInicio
        : !ficha.ptCodigo?.trim();
    if (puestoIncompleto) {
      throw new UnprocessableEntityException(
        'Faltan datos obligatorios del P.T. para poder bloquear la tabla.',
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
}

export interface FilaExcluida {
  recordId: string;
  eje: number | null;
  lado: string | null;
  // Solo motivos POR FILA (t/rd) — ver motivosInvalidosDeFila.
  motivos: MotivoInvalido[];
}

// kmInvalido/fechaInvalido aplican a nivel FICHA (no a una fila puntual) —
// null cuando ese flag no está activo. Compartida entre ResumenVerificacion
// (POST .../validate) y PreviewMedicionResult (GET .../preview, ver
// NewMeasurementPreviewService.obtenerPreview + obtenerFlagsRaiz más arriba):
// mismo par de campos, mismo lugar (raíz de la respuesta) en los 2 endpoints.
export interface FlagsFichaNivelRaiz {
  kmInvalido: { motivo: string } | null;
  fechaInvalido: { motivo: string } | null;
}

export interface ResumenVerificacion extends FlagsFichaNivelRaiz {
  // Binario: false si CUALQUIERA de los 4 flags (t/rd por fila, km/fecha a
  // nivel ficha) sigue activo tras la re-evaluación — es el mismo valor que
  // measurement_sheet.verificado queda tras este POST (ver más arriba).
  todoValido: boolean;
  // Ordenado por el mismo criterio jerárquico que el resto del sistema (ver
  // ORDEN_FISICO_DEFECTO) — listo para renderizar tal cual, sin reordenar.
  // Solo incluye filas con un problema PROPIO (t/rd): un problema de
  // km/fecha ya se reporta una única vez arriba, nunca repetido acá fila por
  // fila (ver motivosInvalidosDeFila).
  filasExcluidas: FilaExcluida[];
  filasIncluidas: number;
  alertasReperfilado: string[];
}

export interface ResumenBloqueo {
  fichaId: string;
  tablaBloqueada: boolean;
}

// Determina si una fila entra a filasExcluidas: SOLO por un problema propio
// (t/rd) — un problema de km/fecha es a nivel ficha y no hace que la fila en
// sí misma se liste (ver FlagsFichaNivelRaiz), aunque sí tira todoValido a
// false vía el chequeo aparte en verificar().
function esInvalida(f: { tInvalido: boolean; rdInvalido: boolean }): boolean {
  return f.tInvalido || f.rdInvalido;
}
