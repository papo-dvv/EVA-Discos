import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolverNumerosCochePorTren,
  validarTrenAlstom,
} from './new-measurement-catalogo';

const NOMBRE_PLANTILLA =
  'UT-UF-MTO-FR-414 CONTROL DE TRABAJOS EN TORNO FOSA_260730_103107.pdf';

@Injectable()
export class ReprofilingPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generar(fichaId: string): Promise<Uint8Array> {
    const ficha = await this.prisma.measurementSheet.findUnique({
      where: { id: fichaId },
      include: {
        instrumentos: { orderBy: { posicion: 'asc' } },
        tecnicos: { orderBy: { posicion: 'asc' } },
      },
    });
    if (!ficha || ficha.motivo !== 'Reperfilado' || !ficha.uploadedFileId) {
      throw new NotFoundException('Ficha de reperfilado no encontrada.');
    }
    const tren = await validarTrenAlstom(this.prisma, ficha.trenNumero);
    const [filas, numerosCoche] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId: ficha.uploadedFileId },
        orderBy: [{ ejeExcel: 'asc' }, { ubicacionExcel: 'asc' }],
      }),
      resolverNumerosCochePorTren(this.prisma, tren.id),
    ]);
    const porPosicion = new Map(
      filas.map((fila) => [`${fila.ejeExcel}|${fila.ubicacionExcel}`, fila]),
    );

    // La página oficial se conserva completa como fondo: logo, código,
    // cuadrícula, límites, diagrama del tren y firmas mantienen exactamente
    // la geometría del documento entregado por Operaciones.
    const plantilla = await readFile(this.rutaPlantilla());
    const pdf = await PDFDocument.load(plantilla);
    const page = pdf.getPage(0);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const tinta = rgb(0.05, 0.12, 0.38);
    const escribir = (
      valor: unknown,
      x: number,
      y: number,
      size = 6.4,
      negrita = false,
    ) => {
      const contenido = String(valor ?? '').trim();
      if (contenido)
        page.drawText(contenido, {
          x,
          y,
          size,
          font: negrita ? bold : font,
          color: tinta,
        });
    };
    const numero = (valor: unknown) =>
      valor === null || valor === undefined ? '' : Number(valor).toFixed(1);
    const fecha = (valor: Date | null) =>
      valor
        ? valor.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })
        : '';
    const fechaHora = (valor: Date | null) =>
      valor
        ? `${valor.toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}  ${valor.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false })}`
        : '';

    escribir(ficha.trenNumero, 88, 708, 7.2, true);
    // La plantilla enviada corresponde a ALSTOM. Para ANSALDO se tapa solo
    // el texto fijo de marca, preservando el resto del encabezado oficial.
    if (ficha.trenNumero <= 5) {
      page.drawRectangle({
        x: 180,
        y: 704,
        width: 96,
        height: 10,
        color: rgb(1, 1, 1),
      });
      escribir('ANSALDO MB300', 181, 707, 6.3, true);
    }
    escribir(ficha.puestoTrabajo, 315, 708, 7.2, true);
    escribir(ficha.kilometraje, 462, 708, 7.2, true);
    escribir(fechaHora(ficha.fechaHoraInicio), 122, 691, 6.8, true);
    escribir(fechaHora(ficha.fechaHoraFin), 315, 691, 6.8, true);

    // Centros de las celdas de la tabla oficial (24 ejes, 2 lados).
    const columnas = {
      izqAntesT: 94,
      izqAntesH: 128,
      izqDespuesT: 162,
      izqDespuesH: 196,
      izqRa: 229,
      derAntesT: 386,
      derAntesH: 420,
      derDespuesT: 454,
      derDespuesH: 488,
      derRa: 521,
    };
    for (let eje = 1; eje <= 24; eje++) {
      // Cada bloque de cuatro ejes tiene un separador doble ligeramente más
      // alto que una línea normal; se descuenta para mantener el texto dentro
      // de la casilla hasta la última fila.
      const y = 568.5 - (eje - 1) * 12.35 - Math.floor((eje - 1) / 4) * 2.35;
      const izq = porPosicion.get(`${eje}|izquierdo`);
      const der = porPosicion.get(`${eje}|derecho`);
      escribir(numero(izq?.reperfiladoTAntes), columnas.izqAntesT, y);
      escribir(numero(izq?.reperfiladoHAntes), columnas.izqAntesH, y);
      escribir(numero(izq?.tValue), columnas.izqDespuesT, y, 6.7, true);
      escribir(numero(izq?.hValue), columnas.izqDespuesH, y, 6.7, true);
      escribir(
        numero(izq?.rugosidadRa),
        columnas.izqRa,
        y,
        6.7,
        true,
      );
      escribir(numero(der?.reperfiladoTAntes), columnas.derAntesT, y);
      escribir(numero(der?.reperfiladoHAntes), columnas.derAntesH, y);
      escribir(numero(der?.tValue), columnas.derDespuesT, y, 6.7, true);
      escribir(numero(der?.hValue), columnas.derDespuesH, y, 6.7, true);
      escribir(
        numero(der?.rugosidadRa),
        columnas.derRa,
        y,
        6.7,
        true,
      );
      escribir(der?.observacion ?? izq?.observacion, 548, y, 5.2);
    }

    // La plantilla imprime el tipo de coche y deja una línea vacía debajo.
    // Se completa con el código físico que corresponde al tren seleccionado.
    const coches = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const;
    coches.forEach((tipo, indice) => {
      escribir(numerosCoche[tipo], 315, 535 - indice * 51.8, 7, true);
    });

    if (ficha.todasConformes !== null)
      escribir('X', ficha.todasConformes ? 390 : 438, 193, 8, true);
    ficha.instrumentos.slice(0, 4).forEach((instrumento, indice) => {
      const y = 158 - indice * 10.2;
      escribir(instrumento.codigo, 53, y, 5.7);
      escribir(instrumento.descripcion, 112, y, 5.7);
      escribir(instrumento.modeloMarca, 293, y, 5.7);
      escribir(fecha(instrumento.fechaCalibracion), 387, y, 5.4);
      escribir(fecha(instrumento.fechaVencimientoCalibracion), 460, y, 5.4);
      escribir(instrumento.observaciones, 532, y, 5.2);
    });
    const comentarios =
      (ficha.comentariosActividad ?? '').match(/.{1,115}(?:\s|$)/g) ?? [];
    comentarios
      .slice(0, 5)
      .forEach((linea, indice) =>
        escribir(linea.trim(), 45, 115 - indice * 9, 5.7),
      );
    ficha.tecnicos.slice(0, 2).forEach((tecnico, indice) => {
      const y = 72 - indice * 10;
      escribir('TÉCNICO', 52, y, 5.5, true);
      escribir(tecnico.nombre, 210, y, 6.1, true);
      escribir(tecnico.firma, 505, y, 5.6);
    });
    escribir('RESPONSABLE DE MANTENIMIENTO', 52, 53, 5.1, true);
    escribir(ficha.responsableMantenimientoNombre, 210, 53, 6.1, true);
    escribir(ficha.responsableMantenimientoFirma, 505, 53, 5.6);
    escribir(
      ficha.ingMrNombre,
      210,
      34,
      6.1,
      true,
    );
    escribir(
      ficha.ingMrFirma,
      505,
      34,
      5.6,
    );

    return pdf.save();
  }

  private rutaPlantilla(): string {
    const rutas = [
      process.env.REPERFILADO_PDF_TEMPLATE,
      join(process.cwd(), 'assets', NOMBRE_PLANTILLA),
      join('/Users/appletec/Downloads', NOMBRE_PLANTILLA),
    ].filter((ruta): ruta is string => Boolean(ruta));
    const encontrada = rutas.find((ruta) => existsSync(ruta));
    if (!encontrada) {
      throw new ServiceUnavailableException(
        'No se encontró la plantilla oficial UT-UF-MTO-FR-414 para generar el PDF.',
      );
    }
    return encontrada;
  }
}
