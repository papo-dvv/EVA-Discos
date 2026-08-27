import { existsSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const NOMBRE_ARCHIVO_RELACION_BOGIES = 'EVA_relacion_bogies - ALSTOM.xlsx';

function resolverArchivoRelacionBogies(): string | null {
  const candidatos = [
    path.join(process.cwd(), 'test-data', NOMBRE_ARCHIVO_RELACION_BOGIES),
    path.join(
      process.cwd(),
      'apps/api/test-data',
      NOMBRE_ARCHIVO_RELACION_BOGIES,
    ),
  ];
  return candidatos.find((archivo) => existsSync(archivo)) ?? null;
}

type FilaRelacionBogie = {
  TREN?: string;
  COCHE?: string;
  POSICION?: string;
  BOGIE_ACTUAL?: string;
  EJE_ACTUAL?: string;
  FECHA_ULTIMO_CAMBIO?: string | number | Date;
};

export type RelacionBogieCatalogo = {
  id: string;
  trenNumero: number;
  trenCodigo: string;
  coche: string;
  numeroCoche: number | null;
  posicion: string;
  serieBogie: string;
  bogieActual: string;
  ejeActual: string | null;
  fechaUltimoCambio: string | null;
};

export type RelacionBogieInput = {
  trenNumero: number;
  coche: string;
  posicion: string;
  serieBogie: string;
  ejeActual?: string | null;
  fechaUltimoCambio?: string | null;
};

type CacheRelacion = {
  porTren: Map<number, Record<string, string>>;
  catalogo: RelacionBogieCatalogo[];
};

let cache: CacheRelacion | null = null;

function normalizarTren(valor: unknown): number | null {
  const texto = String(valor ?? '')
    .trim()
    .toUpperCase();
  const match = texto.match(/^T?0*(\d+)$/);
  return match ? Number(match[1]) : null;
}

function trenCodigo(trenNumero: number): string {
  return `T${String(trenNumero).padStart(2, '0')}`;
}

function idRelacion(
  trenNumero: number,
  coche: string,
  posicion: string,
): string {
  return `${trenNumero}:${coche}:${posicion}`;
}

function serieDesdeBogieActual(codigo: string): string {
  return codigo.includes('/')
    ? codigo.split('/').at(-1)?.trim() || codigo
    : codigo;
}

function bogieActual(posicion: string, serie: string): string {
  const serieLimpia = String(serie).trim().toUpperCase();
  return serieLimpia.includes('/')
    ? serieLimpia
    : `${posicion}/${serieLimpia.padStart(3, '0')}`;
}

function normalizarInput(
  input: RelacionBogieInput,
): Required<RelacionBogieInput> {
  return {
    trenNumero: Number(input.trenNumero),
    coche: String(input.coche ?? '')
      .trim()
      .toUpperCase(),
    posicion: String(input.posicion ?? '')
      .trim()
      .toUpperCase(),
    serieBogie: serieDesdeBogieActual(
      String(input.serieBogie ?? '')
        .trim()
        .toUpperCase(),
    ).padStart(3, '0'),
    ejeActual:
      String(input.ejeActual ?? '')
        .trim()
        .toUpperCase() || null,
    fechaUltimoCambio: String(input.fechaUltimoCambio ?? '').trim() || null,
  };
}

function fechaExcel(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (!fecha) return null;
    return `${fecha.y}-${String(fecha.m).padStart(2, '0')}-${String(fecha.d).padStart(2, '0')}`;
  }
  const texto = String(valor ?? '').trim();
  return texto || null;
}

function archivoRelacionBogiesObligatorio(): string {
  const archivo = resolverArchivoRelacionBogies();
  if (!archivo) {
    throw new Error(
      `No se encontró ${NOMBRE_ARCHIVO_RELACION_BOGIES} en test-data.`,
    );
  }
  return archivo;
}

function leerFilasRelacion(): {
  archivo: string;
  workbook: XLSX.WorkBook;
  sheetName: string;
  filas: FilaRelacionBogie[];
} {
  const archivo = archivoRelacionBogiesObligatorio();
  const workbook = XLSX.readFile(archivo);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const filas = XLSX.utils.sheet_to_json<FilaRelacionBogie>(sheet, {
    defval: '',
  });
  return { archivo, workbook, sheetName, filas };
}

function escribirFilasRelacion(
  archivo: string,
  workbook: XLSX.WorkBook,
  sheetName: string,
  filas: FilaRelacionBogie[],
): void {
  const sheet = XLSX.utils.json_to_sheet(filas, {
    header: [
      'TREN',
      'COCHE',
      'POSICION',
      'BOGIE_ACTUAL',
      'EJE_ACTUAL',
      'FECHA_ULTIMO_CAMBIO',
    ],
  });
  workbook.Sheets[sheetName] = sheet;
  XLSX.writeFile(workbook, archivo);
  cache = null;
}

function cargarRelacion(): CacheRelacion {
  if (cache) return cache;
  const porTren = new Map<number, Record<string, string>>();
  const catalogo: RelacionBogieCatalogo[] = [];
  const archivo = resolverArchivoRelacionBogies();
  if (!archivo) {
    cache = { porTren, catalogo };
    return cache;
  }

  const workbook = XLSX.readFile(archivo);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<FilaRelacionBogie>(sheet, {
    defval: '',
  });

  for (const fila of filas) {
    const tren = normalizarTren(fila.TREN);
    const coche = String(fila.COCHE ?? '')
      .trim()
      .toUpperCase();
    const posicion = String(fila.POSICION ?? '')
      .trim()
      .toUpperCase();
    const codigo = String(fila.BOGIE_ACTUAL ?? '')
      .trim()
      .toUpperCase();
    if (!tren || !coche || !posicion || !codigo) continue;
    const codigos = porTren.get(tren) ?? {};
    codigos[`${coche}:${posicion}`] = codigo;
    porTren.set(tren, codigos);
    catalogo.push({
      id: idRelacion(tren, coche, posicion),
      trenNumero: tren,
      trenCodigo: trenCodigo(tren),
      coche,
      numeroCoche: null,
      posicion,
      serieBogie: serieDesdeBogieActual(codigo),
      bogieActual: codigo,
      ejeActual:
        String(fila.EJE_ACTUAL ?? '')
          .trim()
          .toUpperCase() || null,
      fechaUltimoCambio: fechaExcel(fila.FECHA_ULTIMO_CAMBIO),
    });
  }

  cache = { porTren, catalogo };
  return cache;
}

export function codigosBogiePorTren(
  trenNumero: number,
): Record<string, string> | null {
  return cargarRelacion().porTren.get(trenNumero) ?? null;
}

export function catalogoRelacionBogies(): RelacionBogieCatalogo[] {
  return cargarRelacion().catalogo;
}

export function crearRelacionBogie(
  input: RelacionBogieInput,
): RelacionBogieCatalogo {
  const normalizado = normalizarInput(input);
  const { archivo, workbook, sheetName, filas } = leerFilasRelacion();
  const existe = filas.some((fila) => {
    const tren = normalizarTren(fila.TREN);
    const coche = String(fila.COCHE ?? '')
      .trim()
      .toUpperCase();
    const posicion = String(fila.POSICION ?? '')
      .trim()
      .toUpperCase();
    return (
      tren === normalizado.trenNumero &&
      coche === normalizado.coche &&
      posicion === normalizado.posicion
    );
  });
  if (existe)
    throw new Error('Ya existe una relación para ese tren, coche y bogie.');

  filas.push({
    TREN: trenCodigo(normalizado.trenNumero),
    COCHE: normalizado.coche,
    POSICION: normalizado.posicion,
    BOGIE_ACTUAL: bogieActual(normalizado.posicion, normalizado.serieBogie),
    EJE_ACTUAL: normalizado.ejeActual ?? '',
    FECHA_ULTIMO_CAMBIO: normalizado.fechaUltimoCambio ?? '',
  });
  escribirFilasRelacion(archivo, workbook, sheetName, filas);
  return catalogoRelacionBogies().find(
    (fila) =>
      fila.trenNumero === normalizado.trenNumero &&
      fila.coche === normalizado.coche &&
      fila.posicion === normalizado.posicion,
  )!;
}

export function actualizarRelacionBogie(
  id: string,
  input: RelacionBogieInput,
): RelacionBogieCatalogo {
  const [trenId, cocheId, posicionId] = id.split(':');
  const normalizado = normalizarInput(input);
  const { archivo, workbook, sheetName, filas } = leerFilasRelacion();
  const indice = filas.findIndex((fila) => {
    const tren = normalizarTren(fila.TREN);
    const coche = String(fila.COCHE ?? '')
      .trim()
      .toUpperCase();
    const posicion = String(fila.POSICION ?? '')
      .trim()
      .toUpperCase();
    return (
      tren === Number(trenId) && coche === cocheId && posicion === posicionId
    );
  });
  if (indice < 0) throw new Error('No se encontró la relación de bogie.');

  filas[indice] = {
    TREN: trenCodigo(normalizado.trenNumero),
    COCHE: normalizado.coche,
    POSICION: normalizado.posicion,
    BOGIE_ACTUAL: bogieActual(normalizado.posicion, normalizado.serieBogie),
    EJE_ACTUAL: normalizado.ejeActual ?? '',
    FECHA_ULTIMO_CAMBIO: normalizado.fechaUltimoCambio ?? '',
  };
  escribirFilasRelacion(archivo, workbook, sheetName, filas);
  return catalogoRelacionBogies().find(
    (fila) =>
      fila.trenNumero === normalizado.trenNumero &&
      fila.coche === normalizado.coche &&
      fila.posicion === normalizado.posicion,
  )!;
}

export function eliminarRelacionBogie(id: string): void {
  const [trenId, cocheId, posicionId] = id.split(':');
  const { archivo, workbook, sheetName, filas } = leerFilasRelacion();
  const restantes = filas.filter((fila) => {
    const tren = normalizarTren(fila.TREN);
    const coche = String(fila.COCHE ?? '')
      .trim()
      .toUpperCase();
    const posicion = String(fila.POSICION ?? '')
      .trim()
      .toUpperCase();
    return !(
      tren === Number(trenId) &&
      coche === cocheId &&
      posicion === posicionId
    );
  });
  if (restantes.length === filas.length)
    throw new Error('No se encontró la relación de bogie.');
  escribirFilasRelacion(archivo, workbook, sheetName, restantes);
}
