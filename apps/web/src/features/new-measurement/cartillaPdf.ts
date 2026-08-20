import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { construirFilasEspejo } from './filaEspejo'
import type { FichaMedicion, PosicionEsqueleto, PreviewRow } from './types'

const PLANTILLA = '/UT-UF-MTO-FR-215 CARTILLA DE MANTENIMIENTO PREVENTIVO IM1 - TREN ALSTOM v6.pdf'
const COCHES = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2']
const FILAS_Y = [710, 697, 684, 671, 644, 630, 617, 604, 577, 564, 551, 537, 511, 497, 471, 457, 430, 417, 404, 390, 364, 350, 337, 324]

function texto(value: number | string | null | undefined, decimales = 2) {
  return typeof value === 'number' ? value.toFixed(decimales) : value?.trim() || ''
}

function fecha(value: string) {
  const [anio, mes, dia] = value.slice(0, 10).split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : ''
}

function descargar(bytes: Uint8Array, nombre: string) {
  const copia = new Uint8Array(bytes)
  const url = URL.createObjectURL(new Blob([copia.buffer], { type: 'application/pdf' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

async function dibujarFirma(
  page: ReturnType<PDFDocument['getPages']>[number],
  firma: string | null | undefined,
  x: number,
  y: number,
  maximoAncho = 46,
  maximoAlto = 14,
) {
  if (!firma?.startsWith('data:image/')) return
  const pdf = page.doc
  const imagen = firma.startsWith('data:image/png')
    ? await pdf.embedPng(firma)
    : await pdf.embedJpg(firma)
  const escala = Math.min(maximoAncho / imagen.width, maximoAlto / imagen.height, 1)
  page.drawImage(imagen, { x, y, width: imagen.width * escala, height: imagen.height * escala })
}

export async function descargarCartillaPdf(ficha: FichaMedicion, esqueleto: PosicionEsqueleto[], rows: PreviewRow[]) {
  const bytes = await fetch(PLANTILLA).then(async (respuesta) => {
    if (!respuesta.ok) throw new Error('No se pudo cargar la plantilla de la cartilla.')
    return respuesta.arrayBuffer()
  })
  const pdf = await PDFDocument.load(bytes)
  const page = pdf.getPage(0)
  const fuente = await pdf.embedFont(StandardFonts.Helvetica)
  const escribir = (page: ReturnType<PDFDocument['getPages']>[number], valor: string, x: number, y: number, size = 6.5) => {
    if (valor) page.drawText(valor, { x, y, size, font: fuente, color: rgb(0, 0, 0) })
  }
  const escribirCentrado = (page: ReturnType<PDFDocument['getPages']>[number], valor: string, centroX: number, y: number, size = 6.5) => {
    if (!valor) return
    escribir(page, valor, centroX - fuente.widthOfTextAtSize(valor, size) / 2, y, size)
  }

  const filasPorPosicion = new Map(
    construirFilasEspejo(esqueleto, rows).map((fila) => [
      `${fila.tipoCoche}|${fila.ejeNumero}`,
      fila,
    ]),
  )
  // maximoAltoFirma calibrado contra la plantilla real (ver public/*.pdf):
  // Técnico 1/2 (y=79) solo tiene ~12pt libres antes de pisar el texto
  // "REALIZADO POR:" de arriba (baseline y≈91); Técnico 3/4 (y=55) tiene
  // 24pt libres hasta la fila de Técnico 1/2; Ing MR/Responsable (y=36)
  // tiene 19pt libres hasta Técnico 3/4. maximoAncho (46) es común a todas
  // — el ancho es la restricción real en la práctica (aspecto ~3:1 del
  // canvas de FirmaDigital), y ya deja margen antes de la columna "nombre".
  const posiciones = [
    { firma: [120, 79], nombre: [168, 80], fecha: [242, 80], maximoAltoFirma: 11 }, // Técnico 1
    { firma: [345, 79], nombre: [393, 80], fecha: [535, 80], maximoAltoFirma: 11 }, // Técnico 2
    { firma: [120, 55], nombre: [168, 56], fecha: [242, 56], maximoAltoFirma: 20 }, // Técnico 3
    { firma: [345, 55], nombre: [393, 56], fecha: [535, 56], maximoAltoFirma: 20 }, // Técnico 4
  ] as const

  escribirCentrado(page, fecha(ficha.fechaFicha), 435, 763)
  escribirCentrado(page, String(ficha.trenNumero), 510, 763)
  escribirCentrado(page, String(ficha.kilometraje), 510, 753)

  for (const [indiceCoche, coche] of COCHES.entries()) {
    for (let eje = 1; eje <= 4; eje += 1) {
      const y = FILAS_Y[indiceCoche * 4 + eje - 1]
      const fila = filasPorPosicion.get(`${coche}|${indiceCoche * 4 + eje}`)
      const izquierdo = fila?.izquierdo
      const derecho = fila?.derecho
      escribirCentrado(page, izquierdo?.estadoCalculado ?? '', 70, y, 3.2)
      escribirCentrado(page, texto(izquierdo?.rdValue), 102, y)
      escribirCentrado(page, texto(izquierdo?.tValue), 142, y)
      escribirCentrado(page, texto(izquierdo?.hValue), 183, y)
      escribirCentrado(page, texto(derecho?.hValue), 336, y)
      escribirCentrado(page, texto(derecho?.tValue), 376, y)
      escribirCentrado(page, texto(derecho?.rdValue), 415, y)
      escribirCentrado(page, derecho?.estadoCalculado ?? '', 443, y, 3.2)
    }
    const numeroCoche = filasPorPosicion.get(`${coche}|${indiceCoche * 4 + 1}`)?.numeroCoche
    if (numeroCoche !== null && numeroCoche !== undefined) {
      escribirCentrado(page, String(numeroCoche), 255, FILAS_Y[indiceCoche * 4 + 2], 6)
    }
  }

  if (ficha.todasConformes !== null) escribir(page, 'X', ficha.todasConformes ? 339 : 361, 254, 6)
  ficha.instrumentos.slice(0, 3).forEach((instrumento, indice) => {
    const y = [188, 172, 156][indice]
    escribir(page, texto(instrumento.codigo), 30, y)
    escribir(page, texto(instrumento.descripcion), 92, y)
    escribir(page, texto(instrumento.modeloMarca), 215, y)
    escribir(page, fecha(instrumento.fechaCalibracion ?? ''), 300, y)
    escribir(page, fecha(instrumento.fechaVencimientoCalibracion ?? ''), 405, y)
    escribir(page, texto(instrumento.observaciones), 467, y)
  })
  // x=70/y=136 calibrado contra la plantilla: la línea en blanco de
  // "Observaciones:" (mismo renglón, a la derecha de la etiqueta) queda a
  // y≈134 — el texto va con la base apenas arriba, sobre la línea, no
  // flotando en el hueco hacia la siguiente línea (ver comentario del PDF).
  escribir(page, texto(ficha.comentariosActividad), 70, 136, 6)

  for (const tecnico of ficha.tecnicos) {
    const posicion = posiciones[tecnico.posicion - 1]
    if (!posicion) continue
    await dibujarFirma(page, tecnico.firma, posicion.firma[0], posicion.firma[1], undefined, posicion.maximoAltoFirma)
    escribir(page, texto(tecnico.nombre), posicion.nombre[0], posicion.nombre[1], 4.5)
    escribir(page, fecha(tecnico.fecha ?? ''), posicion.fecha[0], posicion.fecha[1], 4.5)
  }
  await dibujarFirma(page, ficha.ingMrFirma, 120, 36, undefined, 15)
  escribir(page, texto(ficha.ingMrNombre), 168, 37, 4.5)
  escribir(page, fecha(ficha.ingMrFecha ?? ''), 242, 37, 4.5)
  await dibujarFirma(page, ficha.responsableMantenimientoFirma, 345, 36, undefined, 15)
  escribir(page, texto(ficha.responsableMantenimientoNombre), 393, 37, 4.5)
  escribir(page, fecha(ficha.responsableMantenimientoFecha ?? ''), 535, 37, 4.5)

  descargar(await pdf.save(), `cartilla-preventiva-tren-${ficha.trenNumero}-${ficha.fechaFicha.slice(0, 10)}.pdf`)
}
