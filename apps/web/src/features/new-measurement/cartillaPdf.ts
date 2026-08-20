import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { construirFilasEspejo } from './filaEspejo'
import type { FichaMedicion, PosicionEsqueleto, PreviewRow } from './types'

const PLANTILLA = '/UT-UF-MTO-FR-215 CARTILLA DE MANTENIMIENTO PREVENTIVO IM1 - TREN ALSTOM v6.pdf'
const COCHES = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2']
const FILAS_Y = [710, 697, 684, 671, 644, 630, 617, 604, 577, 564, 551, 537, 511, 497, 471, 457, 430, 417, 404, 390, 364, 350, 337, 324]
const COORDENADA_NUMERO_COCHE: Partial<Record<string, { x: number; y: number }>> = {
  REM: { x: 255, y: 476 },
}

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

// Corta `texto` en líneas que no superen `anchoMaximo` a `size`, partiendo
// por palabras (sin cortar una palabra a la mitad salvo que ella sola ya
// exceda el ancho, caso borde que igual se deja pasar entera).
function dividirEnLineas(fuente: Awaited<ReturnType<PDFDocument['embedFont']>>, valor: string, size: number, anchoMaximo: number) {
  const palabras = valor.split(/\s+/).filter(Boolean)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (actual && fuente.widthOfTextAtSize(candidata, size) > anchoMaximo) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = candidata
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

// Recorta `linea` letra por letra hasta que "<linea>…" entre en `anchoMaximo`.
function truncarConElipsis(fuente: Awaited<ReturnType<PDFDocument['embedFont']>>, linea: string, size: number, anchoMaximo: number) {
  if (fuente.widthOfTextAtSize(linea, size) <= anchoMaximo) return linea
  let recorte = linea
  while (recorte.length > 0 && fuente.widthOfTextAtSize(`${recorte}…`, size) > anchoMaximo) {
    recorte = recorte.slice(0, -1)
  }
  return `${recorte}…`
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
      const coordenadaNumero = COORDENADA_NUMERO_COCHE[coche] ?? { x: 255, y: FILAS_Y[indiceCoche * 4 + 2] }
      escribirCentrado(page, String(numeroCoche), coordenadaNumero.x, coordenadaNumero.y, 6)
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
  // Recuadro de "Observaciones" calibrado contra la plantilla real (borde
  // superior y=135, inferior y=115, izquierdo x=55, derecho x≈563 — ver
  // grilla dibujada sobre el PDF real). La etiqueta "Observaciones:" vive
  // en la celda a la izquierda del borde (termina en x≈58), por eso la
  // primera línea arranca sobre la línea después de la etiqueta; las
  // siguientes continúan debajo con el mismo margen izquierdo.
  // Si el comentario no entra en una sola línea, se reparte hasta en 3
  // (135 / 127.5 / 120 — la última deja ~5pt de aire sobre el borde
  // inferior) y, si aun así sobra texto, la 3ª línea se recorta con "…".
  const comentario = texto(ficha.comentariosActividad)
  if (comentario) {
    const tamanoObs = 6
    const xObservaciones = 118
    const yObservaciones = 129
    const anchoMaximoObs = 440 // 558 (borde derecho usable) - 118 (x de texto)
    const maximoLineas = 3
    const lineas = dividirEnLineas(fuente, comentario, tamanoObs, anchoMaximoObs)
    const lineasVisibles = lineas.slice(0, maximoLineas)
    if (lineas.length > maximoLineas) {
      const ultimoIndice = lineasVisibles.length - 1
      lineasVisibles[ultimoIndice] = truncarConElipsis(fuente, lineasVisibles[ultimoIndice], tamanoObs, anchoMaximoObs)
    }
    lineasVisibles.forEach((linea, indice) => {
      escribir(page, linea, xObservaciones, yObservaciones - indice * 8, tamanoObs)
    })
  }

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
