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
  maximoAncho = 46,
  maximoAlto = 12,
): Promise<void> {
  if (!firma?.startsWith('data:image/')) return;
  const imagen = firma.startsWith('data:image/png')
    ? await pdf.embedPng(firma)
    : await pdf.embedJpg(firma);
  const escala = Math.min(
    maximoAncho / imagen.width,
    maximoAlto / imagen.height,
    1,
  );
  page.drawImage(imagen, {
    x,
    y,
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
      escribir(numero(izq ? 2.5 : null), columnas.izqRa, y, 6.7, true);
      escribir(numero(der?.reperfiladoTAntes), columnas.derAntesT, y);
      escribir(numero(der?.reperfiladoHAntes), columnas.derAntesH, y);
      escribir(numero(der?.tValue), columnas.derDespuesT, y, 6.7, true);
      escribir(numero(der?.hValue), columnas.derDespuesH, y, 6.7, true);
      escribir(numero(der ? 2.5 : null), columnas.derRa, y, 6.7, true);
      escribir(der?.observacion ?? izq?.observacion, 548, y, 5.2);
    }

    // Una fila del eje está "llenada" si tiene alguna medición cargada (antes
    // o después del reperfilado) — evita imprimir el número de coche o el
    // código de bogie de bloques que en la cartilla real quedaron en blanco.
    const filaLlenada = (fila: (typeof filas)[number] | undefined): boolean =>
      Boolean(
        fila &&
        (fila.tValue !== null ||
          fila.hValue !== null ||
          fila.reperfiladoTAntes !== null ||
          fila.reperfiladoHAntes !== null),
      );
    const ejeTieneDatos = (eje: number): boolean =>
      filaLlenada(porPosicion.get(`${eje}|izquierdo`)) ||
      filaLlenada(porPosicion.get(`${eje}|derecho`));

    // La plantilla imprime el tipo de coche y deja una línea en blanco debajo
    // para el código físico — el número debe apoyarse ARRIBA de esa línea
    // (como cualquier campo "a completar sobre la raya"), nunca cruzarla. La
    // línea real, medida sobre la plantilla renderizada, cae en y≈538 para el
    // primer bloque (535 - antes usado - quedaba 3pt por debajo de la línea,
    // atravesándola).
    const coches = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const;
    coches.forEach((tipo, indice) => {
      const ejeBase = indice * 4;
      const tieneDatos = [1, 2, 3, 4].some((offset) =>
        ejeTieneDatos(ejeBase + offset),
      );
      if (tieneDatos)
        escribir(numerosCoche[tipo], 315, 546 - indice * 51.8, 7, true);
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
        561 - (ejeInicio - 1) * 12.35 - Math.floor((ejeInicio - 1) / 4) * 2.35;
      if (ejeTieneDatos(ejeInicio) || ejeTieneDatos(ejeInicio + 1))
        escribir(codigosBogie[posicion], 49, y, 5.8, true);
    });

    // Coordenadas de los corchetes "Si [ ] No [ ]" leídas directamente de la
    // plantilla (pdftotext -bbox): centro entre "[" y "]" para cada opción.
    if (ficha.todasConformes !== null) {
      const tamanoX = 7.5;
      const centroXConforme = ficha.todasConformes ? 386.7 : 436.5;
      const centroYConforme = 199.25;
      const anchoX = bold.widthOfTextAtSize('X', tamanoX);
      escribir(
        'X',
        centroXConforme - anchoX / 2,
        centroYConforme - tamanoX * 0.35,
        tamanoX,
        true,
      );
    }
    // Filas de la tabla de instrumentos calibradas contra las líneas
    // divisoras reales de la plantilla (167.7 / 157.6 / 147.5 / 137.4) — el
    // valor previo (158 - indice*10.2) dejaba cada fila corrida hacia abajo.
    ficha.instrumentos.slice(0, 4).forEach((instrumento, indice) => {
      const y = 170.2 - indice * 10.1;
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
    // Tabla CARGO | NOMBRES Y APELLIDOS | FIRMA: las 3 primeras filas están en
    // blanco en la plantilla (el cargo lo escribe cada técnico a mano/en su
    // campo, nunca lo completamos nosotros) — filas calibradas contra las
    // líneas divisoras reales (60.5 / 50.8 / 41.0). La 4ª fila ya trae
    // impreso "SUPERVISOR / COORDINADOR / TÉCNICO ESPECIALISTA", por lo que
    // solo se completan nombre y firma del Responsable de Mantenimiento.
    for (const [indice, tecnico] of ficha.tecnicos.slice(0, 3).entries()) {
      const y = 63 - indice * 10;
      escribir(tecnico.cargo, 52, y, 5.5, true);
      escribir(tecnico.nombre, 210, y, 6.1, true);
      await dibujarFirma(pdf, page, tecnico.firma, 505, y - 2);
    }
    escribir(ficha.responsableMantenimientoNombre, 210, 30, 6.1, true);
    await dibujarFirma(pdf, page, ficha.responsableMantenimientoFirma, 505, 28);

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
