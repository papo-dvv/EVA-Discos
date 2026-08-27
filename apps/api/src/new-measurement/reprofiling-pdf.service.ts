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

// firma es un data URL base64 (PNG/JPG del pad de firma digital, ver
// FirmaDigital.tsx) — se dibuja como imagen embebida, nunca como texto (mismo
// criterio que dibujarFirma en apps/web/src/features/new-measurement/cartillaPdf.ts).
async function dibujarFirma(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument['getPage']>,
  firma: string | null | undefined,
  x: number,
  y: number,
  maximoAncho = 84,
  maximoAlto = 13,
): Promise<void> {
  const coincidencia = firma?.match(/^data:image\/(png|jpe?g);base64,([\s\S]+)$/i);
  if (!coincidencia) return;
  // Se convierte el data URL a bytes antes de incrustarlo. Así pdf-lib nunca
  // interpreta la cadena base64 como texto y la firma conserva sus trazos.
  const bytes = Uint8Array.from(Buffer.from(coincidencia[2], 'base64'));
  const imagen = coincidencia[1].toLowerCase() === 'png'
    ? await pdf.embedPng(bytes)
    : await pdf.embedJpg(bytes);
  const escala = Math.min(
    maximoAncho / imagen.width,
    maximoAlto / imagen.height,
    1,
  );
  page.drawImage(imagen, {
    // El punto recibido es el centro de la casilla de firma, no su esquina:
    // queda centrada y contenida aunque el trazo sea muy ancho o alto.
    x: x - (imagen.width * escala) / 2,
    y: y - (imagen.height * escala) / 2,
    width: imagen.width * escala,
    height: imagen.height * escala,
  });
}

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
    const [filas, numerosCatalogo] = await Promise.all([
      this.prisma.scanRecord.findMany({
        where: { fileId: ficha.uploadedFileId },
        orderBy: [{ ejeExcel: 'asc' }, { ubicacionExcel: 'asc' }],
      }),
      resolverNumerosCochePorTren(this.prisma, tren.id),
    ]);
    const numerosCoche = {
      ...numerosCatalogo,
      ...((ficha.codigosCoche as Record<string, number> | null) ?? {}),
    };
    const codigosBogie =
      (ficha.codigosBogie as Record<string, string> | null) ?? {};
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
    // Todo texto que entra en un recuadro se recorta a su ancho útil. La
    // plantilla es muy densa: sin este límite un P.T., observación o nombre
    // largo invade la celda siguiente al exportar el PDF.
    const ajustarTexto = (valor: unknown, ancho: number, size: number) => {
      let contenido = String(valor ?? '').trim();
      while (contenido && font.widthOfTextAtSize(`${contenido}...`, size) > ancho)
        contenido = contenido.slice(0, -1);
      return contenido === String(valor ?? '').trim() ? contenido : `${contenido}...`;
    };
    const escribirCentrado = (
      valor: unknown,
      centroX: number,
      y: number,
      size = 6.4,
      negrita = false,
    ) => {
      const contenido = String(valor ?? '').trim();
      if (!contenido) return;
      const tipo = negrita ? bold : font;
      escribir(
        contenido,
        centroX - tipo.widthOfTextAtSize(contenido, size) / 2,
        y,
        size,
        negrita,
      );
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

    // Coordenadas calibradas contra la plantilla oficial tamaño carta.
    // Los textos se anclan dentro de cada línea, no sobre sus rótulos.
    escribir(ficha.trenNumero, 166, 708, 7.2, true);
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
    escribir(ajustarTexto(ficha.puestoTrabajo, 104, 7.2), 315, 708, 7.2, true);
    escribir(ficha.kilometraje, 442, 708, 7.2, true);
    escribir(fechaHora(ficha.fechaHoraInicio), 116, 691, 6.2, true);
    escribir(fechaHora(ficha.fechaHoraFin), 302, 691, 6.2, true);

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
      // La plantilla mantiene la misma altura de celda para los 24 ejes; los
      // separadores de bloque son solo trazos más gruesos, no filas extra.
      const y = 568.5 - (eje - 1) * 12.35;
      const izq = porPosicion.get(`${eje}|izquierdo`);
      const der = porPosicion.get(`${eje}|derecho`);
      escribirCentrado(numero(izq?.reperfiladoTAntes), columnas.izqAntesT, y);
      escribirCentrado(numero(izq?.reperfiladoHAntes), columnas.izqAntesH, y);
      escribirCentrado(numero(izq?.tValue), columnas.izqDespuesT, y, 6.7, true);
      escribirCentrado(numero(izq?.hValue), columnas.izqDespuesH, y, 6.7, true);
      escribirCentrado(numero(izq ? 2.5 : null), columnas.izqRa, y, 6.7, true);
      escribirCentrado(numero(der?.reperfiladoTAntes), columnas.derAntesT, y);
      escribirCentrado(numero(der?.reperfiladoHAntes), columnas.derAntesH, y);
      escribirCentrado(numero(der?.tValue), columnas.derDespuesT, y, 6.7, true);
      escribirCentrado(numero(der?.hValue), columnas.derDespuesH, y, 6.7, true);
      escribirCentrado(numero(der ? 2.5 : null), columnas.derRa, y, 6.7, true);
      escribir(ajustarTexto(der?.observacion ?? izq?.observacion, 42, 5.2), 548, y, 5.2);
    }

    // La plantilla imprime el tipo de coche y deja una línea vacía debajo.
    // Se completa con el código físico que corresponde al tren seleccionado.
    const coches = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const;
    coches.forEach((tipo, indice) => {
      escribir(numerosCoche[tipo], 315, 535 - indice * 51.8, 7, true);
    });
    const posicionesBogie = [
      ['MA1:PB3', 1],
      ['MA1:PB4', 3],
      ['MB1:PB6', 5],
      ['MB1:PB2', 7],
      ['MB3:PB6', 9],
      ['MB3:PB2', 11],
      ['REM:TB1', 13],
      ['REM:TB2', 15],
      ['MB2:PB2', 17],
      ['MB2:PB6', 19],
      ['MA2:PB4', 21],
      ['MA2:PB3', 23],
    ] as const;
    posicionesBogie.forEach(([posicion, ejeInicio]) => {
      const y =
        561 - (ejeInicio - 1) * 12.35;
      escribirCentrado(codigosBogie[posicion], 59, y, 5.8, true);
    });

    if (ficha.todasConformes !== null)
      escribir('X', ficha.todasConformes ? 390 : 438, 193, 8, true);
    ficha.instrumentos.slice(0, 4).forEach((instrumento, indice) => {
      const y = 158 - indice * 10.2;
      escribir(instrumento.codigo, 53, y, 5.7);
      escribir(ajustarTexto(instrumento.descripcion, 170, 5.7), 112, y, 5.7);
      escribir(ajustarTexto(instrumento.modeloMarca, 82, 5.7), 293, y, 5.7);
      escribir(fecha(instrumento.fechaCalibracion), 387, y, 5.4);
      escribir(fecha(instrumento.fechaVencimientoCalibracion), 460, y, 5.4);
      escribir(ajustarTexto(instrumento.observaciones, 46, 5.2), 532, y, 5.2);
    });
    const comentarios =
      (ficha.comentariosActividad ?? '').match(/.{1,115}(?:\s|$)/g) ?? [];
    comentarios
      .slice(0, 5)
      .forEach((linea, indice) =>
        escribir(linea.trim(), 45, 115 - indice * 9, 5.7),
      );
    for (const [indice, tecnico] of ficha.tecnicos.slice(0, 2).entries()) {
      const y = 72 - indice * 10;
      escribir(tecnico.cargo || 'TÉCNICO', 52, y, 5.5, true);
      escribir(tecnico.nombre, 210, y, 6.1, true);
      await dibujarFirma(pdf, page, tecnico.firma, 520, y + 1);
    }
    escribir('RESPONSABLE DE MANTENIMIENTO', 52, 53, 5.1, true);
    escribir(ajustarTexto(ficha.responsableMantenimientoNombre, 275, 6.1), 210, 53, 6.1, true);
    await dibujarFirma(pdf, page, ficha.responsableMantenimientoFirma, 520, 54);
    escribir(ajustarTexto(ficha.ingMrNombre, 275, 6.1), 210, 34, 6.1, true);
    await dibujarFirma(pdf, page, ficha.ingMrFirma, 520, 35);

    return pdf.save();
  }

  private rutaPlantilla(): string {
    const rutas = [
      process.env.REPERFILADO_PDF_TEMPLATE,
      // process.cwd() es la raíz del monorepo al correr `npm run start` desde
      // ahí, o apps/api al correrlo directamente en ese workspace — se
      // prueban ambos, mismo criterio que ubicarArchivoRelacionBogies
      // (new-measurement-bogie-codes.ts).
      join(process.cwd(), 'assets', NOMBRE_PLANTILLA),
      join(process.cwd(), '..', '..', 'assets', NOMBRE_PLANTILLA),
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
