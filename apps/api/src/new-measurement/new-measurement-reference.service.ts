import { Injectable } from '@nestjs/common';
import type {
  MeasurementSheetInstrumento,
  MeasurementSheetTecnico,
  ScanRecord,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  aPreviewRow,
  type PreviewRow,
} from '../scan-records/scan-record-query';
import type { TipoReferencia } from './dto/reference-query.dto';
import {
  resolverNumerosCochePorTren,
  validarTrenAlstom,
} from './new-measurement-catalogo';
import {
  generarEsqueleto48,
  type PosicionEsqueleto,
} from './new-measurement-esqueleto';

// Comparativa histórica para contrastar una ficha en curso contra el pasado
// de su tren (GET /new-measurement/reference?tren=&tipo=) — sin scope de
// sesión ni de ficha: busca en TODO el historial confirmado, sin importar
// quién ni cuándo lo cargó.
export interface ReferenciaNoDisponible {
  disponible: false;
}

export interface ReferenciaUltimaMedicion {
  disponible: true;
  tren: number;
  fecha: string;
  kilometraje: number;
  responsable: string;
  esqueleto: PosicionEsqueleto[];
  rows: PreviewRow[];
}

export interface ReferenciaUltimaFicha {
  disponible: true;
  tren: number;
  fechaFicha: string;
  kilometraje: number;
  responsable: string | null;
  // P.T. (Puesto de Trabajo) de ESA ficha histórica — ver comentario en
  // MeasurementSheet.ptCodigo. Exclusivo de 'ultima_ficha' (igual que
  // tecnicos/instrumentos/ingMr*): 'ultima_medicion' no tiene P.T. porque no
  // proviene de ninguna ficha real.
  ptCodigo: string | null;
  esqueleto: PosicionEsqueleto[];
  rows: PreviewRow[];
  // Exclusivo de 'ultima_ficha' (ver comentario en obtener): a diferencia de
  // 'ultima_medicion' —que no proviene de ninguna ficha real, solo de
  // ScanRecords individuales—, acá SÍ hay una ficha histórica completa detrás,
  // así que el frontend puede mostrar estas secciones en modo solo-lectura
  // (ver ModalMedicionAnterior). Mismas 2 tablas que FichaDetalle.tecnicos/
  // instrumentos.
  responsableMantenimientoFirma: string | null;
  responsableMantenimientoFecha: string | null;
  ingMrNombre: string | null;
  ingMrFirma: string | null;
  ingMrFecha: string | null;
  tecnicos: MeasurementSheetTecnico[];
  instrumentos: MeasurementSheetInstrumento[];
}

export type ResultadoReferencia =
  ReferenciaNoDisponible | ReferenciaUltimaMedicion | ReferenciaUltimaFicha;

@Injectable()
export class NewMeasurementReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(
    trenNumero: number,
    tipo: TipoReferencia,
  ): Promise<ResultadoReferencia> {
    const tren = await validarTrenAlstom(this.prisma, trenNumero);
    return tipo === 'ultima_medicion'
      ? this.ultimaMedicion(tren.id, trenNumero)
      : this.ultimaFicha(tren.id, trenNumero);
  }

  // Última medición CONFIRMADA de CADA disco del tren (hasta 48 filas, una
  // por disco físico — mismo criterio SOLO_CONFIRMADOS que ScanRecordsService:
  // disc_id no nulo). La card superior usa la fecha globalmente más reciente
  // entre TODOS los discos del tren, no la de un disco en particular.
  private async ultimaMedicion(
    trenId: string,
    trenNumero: number,
  ): Promise<ReferenciaNoDisponible | ReferenciaUltimaMedicion> {
    const confirmados = await this.prisma.scanRecord.findMany({
      where: { trenNumero, discId: { not: null } },
      orderBy: [{ fecha: 'desc' }, { kilometraje: 'desc' }, { id: 'desc' }],
    });
    if (confirmados.length === 0) return { disponible: false };

    const porDisco = new Map<string, ScanRecord>();
    for (const r of confirmados) {
      // Ya ordenado desc: la primera aparición de cada discId es la más
      // reciente de ese disco.
      if (!porDisco.has(r.discId!)) porDisco.set(r.discId!, r);
    }

    const masReciente = confirmados[0];
    const numerosCoche = await resolverNumerosCochePorTren(this.prisma, trenId);

    return {
      disponible: true,
      tren: trenNumero,
      fecha: masReciente.fecha.toISOString().slice(0, 10),
      kilometraje: Number(masReciente.kilometraje),
      responsable: masReciente.responsableNombre,
      esqueleto: generarEsqueleto48(numerosCoche),
      rows: [...porDisco.values()].map(aPreviewRow),
    };
  }

  // Ficha CONFIRMADA más reciente del tren, sin importar el motivo con el que
  // se haya cargado ni la sesión que la creó — histórico completo. "Última"
  // se entiende por fechaFicha (fecha real de la actividad), con createdAt
  // como desempate.
  private async ultimaFicha(
    trenId: string,
    trenNumero: number,
  ): Promise<ReferenciaNoDisponible | ReferenciaUltimaFicha> {
    const ficha = await this.prisma.measurementSheet.findFirst({
      where: { trenNumero, uploadedFile: { status: 'committed' } },
      orderBy: [{ fechaFicha: 'desc' }, { createdAt: 'desc' }],
    });
    if (!ficha || !ficha.uploadedFileId) return { disponible: false };

    const [filas, numerosCoche, tecnicos, instrumentos] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId: ficha.uploadedFileId },
        orderBy: [{ ordenFisico: 'asc' }],
      }),
      resolverNumerosCochePorTren(this.prisma, trenId),
      this.prisma.measurementSheetTecnico.findMany({
        where: { measurementSheetId: ficha.id },
        orderBy: { posicion: 'asc' },
      }),
      this.prisma.measurementSheetInstrumento.findMany({
        where: { measurementSheetId: ficha.id },
        orderBy: { posicion: 'asc' },
      }),
    ]);

    return {
      disponible: true,
      tren: trenNumero,
      fechaFicha: ficha.fechaFicha.toISOString().slice(0, 10),
      kilometraje: Number(ficha.kilometraje),
      responsable: ficha.responsableMantenimientoNombre,
      ptCodigo: ficha.ptCodigo,
      esqueleto: generarEsqueleto48(numerosCoche),
      rows: filas.map(aPreviewRow),
      responsableMantenimientoFirma: ficha.responsableMantenimientoFirma,
      responsableMantenimientoFecha: ficha.responsableMantenimientoFecha
        ? ficha.responsableMantenimientoFecha.toISOString().slice(0, 10)
        : null,
      ingMrNombre: ficha.ingMrNombre,
      ingMrFirma: ficha.ingMrFirma,
      ingMrFecha: ficha.ingMrFecha
        ? ficha.ingMrFecha.toISOString().slice(0, 10)
        : null,
      tecnicos,
      instrumentos,
    };
  }
}
