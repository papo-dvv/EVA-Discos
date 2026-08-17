import type { WorkBook } from 'xlsx';
import { utils } from 'xlsx';
import { LadoDisco } from '../../generated/prisma';
import type {
  BrakeDiscRulesEngine,
  EstadoDiscoAmpliado,
  EstadoDiscoCalculado,
} from '../brake-disc-rules/brake-disc-rules.engine';
import { calcularOrdenFisico } from '../common/orden-fisico';

// Parser puro de la migración masiva desde Excel. Sin Nest ni Prisma: recibe
// un WorkBook ya leído y un motor de reglas ya resuelto, y devuelve las filas
// listas para insertar + el resumen. Toda la lógica de negocio del prompt
// (hojas T06–T44, corrección de tren por hoja, cálculo de Rd/estado por el
// backend, discrepancia contra "Comentario") vive acá, aislada y testeable.

// Rango de hojas de la migración: T06 … T44 (39 hojas). Cualquier otra hoja
// del archivo se ignora; las de este rango que falten se reportan.
export const HOJAS_MIGRACION: readonly string[] = Array.from(
  { length: 39 },
  (_, i) => `T${String(i + 6).padStart(2, '0')}`,
);

// Encabezados (fila 2). Cada campo lista las grafías aceptables; la búsqueda
// normaliza acentos, mayúsculas y símbolos, así que "N° Coche" y "Ubicación"
// se resuelven sin depender del carácter exacto.
const COLUMNAS = {
  responsable: ['Responsable'],
  tren: ['Tren'],
  kilometraje: ['Kilometraje'],
  fecha: ['Fecha'],
  motivo: ['Motivo'],
  coche: ['Coche'],
  numeroCoche: ['N° Coche', 'Nro Coche', 'Numero Coche'],
  bogie: ['Bogie'],
  eje: ['Eje'],
  ubicacion: ['Ubicación'],
  rueda: ['Rueda'],
  h: ['H'],
  t: ['T'],
  // Solo para validación cruzada, nunca como fuente de cálculo:
  comentario: ['Comentario'],
} as const;

export interface FilaMigracion {
  responsableNombre: string;
  trenNumero: number;
  kilometraje: number;
  fecha: Date;
  motivo: string;
  tValue: number;
  hValue: number;
  rdValue: number;
  estadoCalculado: EstadoDiscoAmpliado;
  estadoSugeridoExcel: string | null;
  hojaExcelOrigen: string;
  trenOriginalExcel: number | null;
  corregidoPorHoja: boolean;
  discrepanciaEstadoExcel: boolean;
  // Identidad cruda del disco (se resuelve disc_id recién al confirmar).
  cocheExcel: string | null;
  numeroCocheExcel: number | null;
  bogieExcel: string | null;
  ejeExcel: number | null;
  ubicacionExcel: string | null;
  ruedaExcel: number | null;
  // Precalculado en el parser (nunca ORDER BY alfabético): ver
  // common/orden-fisico.ts. Depende de coche/bogie/eje/lado — nunca de
  // numeroCoche ni de trenNumero (ese se ordena aparte, ver
  // scan-record-query.ts).
  ordenFisico: number;
}

export interface Discrepancia {
  hoja: string;
  filaExcel: number; // número de fila 1-based dentro de la hoja
  tipo: 'tren' | 'estado';
  valorExcel: string | number | null;
  valorSistema: string | number;
}

// Fila que se leyó del rango de la hoja pero no se puede insertar: o le falta
// un dato obligatorio (fecha/H/T/kilometraje) o lanzó un error inesperado. Se
// reporta en el resumen; NUNCA se inserta con valores inventados ni aborta el
// resto del archivo.
export interface FilaInvalida {
  hoja: string;
  fila: number; // número de fila original en la hoja (1-based)
  motivo: string;
}

// Hoja cuyo encabezado no se pudo identificar (faltan columnas obligatorias en
// las primeras filas). La hoja completa se omite y se reporta; no se toma
// ninguna de sus filas como "vacía".
export interface HojaConError {
  hoja: string;
  motivo: string;
}

export interface ResultadoProcesamiento {
  hojasProcesadas: string[];
  hojasFaltantes: string[];
  hojasConError: HojaConError[];
  filas: FilaMigracion[]; // solo las válidas, listas para insertar
  totalFilasLeidas: number; // filas de datos iteradas en todas las hojas
  filasVaciasOmitidas: number; // filas fantasma / totalmente vacías, descartadas
  filasInvalidas: FilaInvalida[]; // con datos pero sin poder insertarse
  detalleDiscrepancias: Discrepancia[];
}

// Mapeo de índice de columna por campo (header:1 => acceso por índice numérico).
export interface MapeoColumnas {
  responsable: number;
  tren: number;
  kilometraje: number;
  fecha: number;
  motivo: number;
  coche: number;
  numeroCoche: number;
  bogie: number;
  eje: number;
  ubicacion: number;
  rueda: number;
  h: number;
  t: number;
  comentario: number;
}

// Columnas sin las cuales no se puede identificar ni insertar una medición.
// Definen cuál de las primeras filas es la de encabezado (detección por contenido).
const CAMPOS_OBLIGATORIOS = [
  'fecha',
  'coche',
  'bogie',
  'eje',
  'h',
  't',
] as const;

// Depuración opt-in: solo imprime si DEBUG_MIGRATION=true (fue clave para hallar
// el bug de desfase de encabezado; se deja disponible sin ensuciar cada carga).
const DEBUG_MIGRACION = process.env.DEBUG_MIGRATION === 'true';

// Las celdas de xlsx llegan como string | number | boolean | Date | null.
// Convertir a texto con esta guarda evita el "[object Object]" que marca
// @typescript-eslint/no-base-to-string sobre un `unknown` crudo.
function comoCadena(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean')
    return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  return '';
}

function normalizar(valor: unknown): string {
  return comoCadena(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos (marcas diacríticas combinantes)
    .replace(/[^a-z0-9 ]/g, ' ') // símbolos como ° en "N° Coche"
    .replace(/\s+/g, ' ')
    .trim();
}

function indiceColumna(
  encabezados: unknown[],
  candidatas: readonly string[],
): number {
  const normalizados = encabezados.map(normalizar);
  for (const candidata of candidatas) {
    const idx = normalizados.indexOf(normalizar(candidata));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Construye el mapeo de columnas a partir de una fila candidata a encabezado.
function construirMapeo(encabezados: unknown[]): MapeoColumnas {
  return {
    responsable: indiceColumna(encabezados, COLUMNAS.responsable),
    tren: indiceColumna(encabezados, COLUMNAS.tren),
    kilometraje: indiceColumna(encabezados, COLUMNAS.kilometraje),
    fecha: indiceColumna(encabezados, COLUMNAS.fecha),
    motivo: indiceColumna(encabezados, COLUMNAS.motivo),
    coche: indiceColumna(encabezados, COLUMNAS.coche),
    numeroCoche: indiceColumna(encabezados, COLUMNAS.numeroCoche),
    bogie: indiceColumna(encabezados, COLUMNAS.bogie),
    eje: indiceColumna(encabezados, COLUMNAS.eje),
    ubicacion: indiceColumna(encabezados, COLUMNAS.ubicacion),
    rueda: indiceColumna(encabezados, COLUMNAS.rueda),
    h: indiceColumna(encabezados, COLUMNAS.h),
    t: indiceColumna(encabezados, COLUMNAS.t),
    comentario: indiceColumna(encabezados, COLUMNAS.comentario),
  };
}

// El mapeo es "de encabezado" si ubica TODAS las columnas obligatorias.
function mapeoCompleto(col: MapeoColumnas): boolean {
  return CAMPOS_OBLIGATORIOS.every((campo) => col[campo] !== -1);
}

function aTextoONull(valor: unknown): string | null {
  const texto = comoCadena(valor).trim();
  return texto === '' ? null : texto;
}

function aNumeroONull(valor: unknown): number | null {
  const texto = aTextoONull(valor);
  if (texto === null) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// True si la celda no trae ningún dato real. OJO: un número 0 o un booleano
// NO son vacíos (un Rd/H/T de 0 es un valor legítimo); solo lo son null,
// undefined y el string vacío/espacios.
function esCeldaVacia(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  return false;
}

// Parseo seguro de fecha: con cellDates:true las fechas reales llegan como Date.
// Devuelve null (no una Invalid Date) si la celda está vacía o no es una fecha
// válida, para que la fila se reporte como inválida en vez de romper el INSERT
// (scan_records.fecha es NOT NULL).
function parsearFechaSegura(valor: unknown): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  const texto = comoCadena(valor).trim();
  if (texto === '') return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Tipos de coche válidos — mismo enum tipo_coche de schema.prisma (MA1, MB1,
// MB3, REM, MB2, MA2). Se listan como texto plano acá (el parser es puro, sin
// Prisma) en vez de importar el enum generado.
const TIPOS_COCHE_VALIDOS: readonly string[] = [
  'MA1',
  'MB1',
  'MB3',
  'REM',
  'MB2',
  'MA2',
];

// Normaliza el valor crudo de "Coche": trim + mayúsculas, y mapea las
// variantes abreviadas de Remolque ("R", "R.") al valor canónico "REM" del
// enum. Se exporta para que migration-commit.service.ts use exactamente la
// misma regla al resolver el catálogo (una sola fuente de verdad: sin esto,
// "MA1"/"Ma1"/"R" convivían como valores distintos en scan_records, lo que
// además duplicaba las opciones del filtro de tipo de coche en el frontend).
export function normalizarCoche(valorCrudo: string | null): string | null {
  const texto = (valorCrudo ?? '').trim().toUpperCase();
  if (texto === '') return null;
  if (texto === 'R' || texto === 'R.') return 'REM';
  return texto;
}

function esTipoCocheValido(valor: string): boolean {
  return TIPOS_COCHE_VALIDOS.includes(valor);
}

// Mapea el texto de "Ubicación" del Excel al lado del disco. Si no es
// reconocible, cae en la convención de numeración de ruedas de la flota
// (impar = izquierda, par = derecha). Se exporta: migration-commit.service.ts
// la usa para resolver el BrakeDisc real al confirmar, y este mismo archivo
// la usa para calcular ordenFisico de cada fila en borrador (ver más abajo) —
// una sola fuente de verdad para "qué lado es esta fila", sin importar si el
// disco ya se resolvió o todavía no.
export function resolverLado(
  ubicacion: string | null,
  rueda: number | null,
): LadoDisco | null {
  const u = (ubicacion ?? '').trim().toLowerCase();
  // includes(), NO startsWith(): el formato real de Ubicación es
  // "disco_freno_N_derecho" / "disco_freno_N_izquierdo" — el lado va de
  // SUFIJO, nunca de prefijo. Con startsWith() esto nunca matcheaba y
  // siempre caía al fallback de paridad de rueda (bug detectado en el caso
  // real Tren 32 / coche 208 / bogie PB4 / eje 22 — ahí la paridad coincidía
  // por casualidad con el lado real, por eso no se notaba en ese eje puntual).
  if (u.includes('izq') || u === 'i' || u === 'left')
    return LadoDisco.izquierdo;
  if (u.includes('der') || u === 'd' || u === 'right') return LadoDisco.derecho;
  if (rueda !== null && Number.isInteger(rueda)) {
    return rueda % 2 === 0 ? LadoDisco.derecho : LadoDisco.izquierdo;
  }
  return null;
}

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'error desconocido';
}

// ⚠️ INSTRUMENTACIÓN TEMPORAL DE DIAGNÓSTICO — REMOVER tras identificar el bug.
// Describe un valor crudo de celda distinguiendo undefined (índice de columna
// no mapeado, filaCruda[-1]) de null (celda vacía real): esa diferencia es la
// clave para saber si el problema es el mapeo de columnas o los datos.
function depurarValor(v: unknown): string {
  const tipo =
    v === undefined
      ? 'undefined'
      : v === null
        ? 'null'
        : v instanceof Date
          ? 'Date'
          : typeof v;
  const repr =
    v === undefined ? 'undefined' : (JSON.stringify(v) ?? '(no serializable)');
  return `${repr} [${tipo}]`;
}

// 'T15' -> 15, 'T06' -> 6. null si el nombre no calza con el patrón.
function numeroDeHoja(nombreHoja: string): number | null {
  const match = /^T(\d{2})$/.exec(nombreHoja.trim());
  if (!match) return null;
  return Number(match[1]);
}

// Mapea el texto libre de "Comentario" a un estado comparable. Devuelve null
// si no corresponde a ninguno de los 4 estados (ej. "Reperfilado" o vacío):
// en ese caso no se puede afirmar que haya discrepancia.
function comentarioAEstado(
  comentario: string | null,
): EstadoDiscoCalculado | null {
  if (comentario === null) return null;
  const s = normalizar(comentario).toUpperCase();
  if (s === 'OK') return 'OK';
  if (s === 'SEGUIMIENTO') return 'SEGUIMIENTO';
  if (s === 'CAMBIO') return 'CAMBIO';
  if (s === 'CRITICO') return 'CRITICO';
  return null;
}

export function procesarWorkbook(
  workbook: WorkBook,
  evaluador: BrakeDiscRulesEngine,
): ResultadoProcesamiento {
  const hojasPresentes = new Set(workbook.SheetNames);
  const hojasHistoricasPresentes = HOJAS_MIGRACION.filter((hoja) =>
    hojasPresentes.has(hoja),
  );
  // Los libros históricos mantienen la semántica T06–T44. Para CSV/TSV/TXT
  // y otros libros sin esas hojas se procesan todas las tablas legibles y el
  // tren se obtiene de la columna "Tren" de cada fila.
  const hojasAProcesar =
    hojasHistoricasPresentes.length > 0
      ? hojasHistoricasPresentes
      : workbook.SheetNames;
  const hojasProcesadas: string[] = [];
  const hojasFaltantes: string[] = [];
  const hojasConError: HojaConError[] = [];
  const filas: FilaMigracion[] = [];
  const filasInvalidas: FilaInvalida[] = [];
  const detalleDiscrepancias: Discrepancia[] = [];
  let totalFilasLeidas = 0;
  let filasVaciasOmitidas = 0;
  // Instrumentación opt-in (DEBUG_MIGRATION): solo la PRIMERA hoja con datos.
  let hojaDepurada = false;

  if (hojasHistoricasPresentes.length > 0) {
    hojasFaltantes.push(
      ...HOJAS_MIGRACION.filter((hoja) => !hojasPresentes.has(hoja)),
    );
  }

  for (const nombreHoja of hojasAProcesar) {
    const trenDeHoja = numeroDeHoja(nombreHoja);
    const hoja = workbook.Sheets[nombreHoja];
    // Matriz de arrays (header:1 => acceso por índice numérico).
    const matriz = utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      blankrows: false,
      defval: null,
    });

    // La fila de encabezado NO está en una posición fija: algunos archivos traen
    // una fila "Panel Principal" antes (encabezados en la fila 2), otros no
    // (encabezados en la fila 1). Se detecta por CONTENIDO: la primera de las
    // primeras 5 filas cuyo mapeo ubique TODAS las columnas obligatorias.
    const maxEscaneo = Math.min(5, matriz.length);
    let headerIdx = -1;
    let col: MapeoColumnas | null = null;
    for (let h = 0; h < maxEscaneo; h++) {
      const posible = construirMapeo(matriz[h] ?? []);
      if (mapeoCompleto(posible)) {
        headerIdx = h;
        col = posible;
        break;
      }
    }

    if (col === null) {
      // No se pudo ubicar el encabezado: la hoja completa se omite (ninguna fila
      // se toma como vacía) y se reporta con el detalle de lo encontrado.
      const faltantes = CAMPOS_OBLIGATORIOS.filter(
        (campo) =>
          !matriz
            .slice(0, maxEscaneo)
            .some(
              (f) => construirMapeo(Array.isArray(f) ? f : [])[campo] !== -1,
            ),
      );
      hojasConError.push({
        hoja: nombreHoja,
        motivo:
          `No se pudo identificar la fila de encabezado en la hoja ${nombreHoja}: ` +
          `faltan columnas obligatorias (${faltantes.join(', ') || 'ninguna'}). ` +
          `Encabezados encontrados en las primeras filas: ${JSON.stringify(
            matriz
              .slice(0, maxEscaneo)
              .map((f) => (Array.isArray(f) ? f.map(normalizar) : f)),
          )}`,
      });
      continue;
    }

    const filaInicioDatos = headerIdx + 1;

    // Instrumentación opt-in (DEBUG_MIGRATION=true) — solo la primera hoja.
    const depurarEstaHoja = DEBUG_MIGRACION && !hojaDepurada;
    let filasDepuradas = 0;
    if (depurarEstaHoja) {
      hojaDepurada = true;
      console.log(
        `[MIGRACION-DEBUG] ===== Hoja ${nombreHoja} (primera procesada) =====`,
      );
      console.log(
        `[MIGRACION-DEBUG] filas en matriz=${matriz.length}; encabezado detectado en índice ${headerIdx} (fila Excel ${
          headerIdx + 1
        }); datos desde fila Excel ${filaInicioDatos + 1}`,
      );
      console.log(
        `[MIGRACION-DEBUG] encabezado CRUDO:`,
        JSON.stringify(matriz[headerIdx]),
      );
      console.log(
        `[MIGRACION-DEBUG] encabezado NORMALIZADO:`,
        JSON.stringify((matriz[headerIdx] ?? []).map(normalizar)),
      );
      console.log(
        `[MIGRACION-DEBUG] MAPEO de columnas (índice por campo; -1 = NO encontrado):`,
        JSON.stringify(col),
      );
    }

    for (let i = filaInicioDatos; i < matriz.length; i++) {
      const filaCruda = matriz[i];
      const filaExcel = i + 1; // 1-based, para reportes legibles
      totalFilasLeidas++;

      // Aislamiento por fila: un error inesperado en UNA fila se reporta y se
      // continúa; nunca aborta la carga completa del archivo.
      try {
        // 1. Detección de fila vacía ANTES de calcular o asignar nada. Excel
        // trae filas "fantasma" al final del rango (con formato de celda pero
        // sin datos). Si TODOS los campos que identifican una medición real
        // vienen vacíos, la fila se descarta por completo.
        const identificadores = [
          filaCruda[col.fecha],
          filaCruda[col.coche],
          filaCruda[col.bogie],
          filaCruda[col.eje],
          filaCruda[col.h],
          filaCruda[col.t],
        ];
        const esFilaVacia = identificadores.every(esCeldaVacia);

        // ⚠️ INSTRUMENTACIÓN TEMPORAL — REMOVER tras el diagnóstico.
        // Solo las primeras 3 filas de datos de la primera hoja: fila cruda,
        // valores extraídos por campo (con su tipo) y el veredicto de "vacía".
        if (depurarEstaHoja && filasDepuradas < 3) {
          filasDepuradas++;
          console.log(
            `[MIGRACION-DEBUG] --- ${nombreHoja} fila Excel ${filaExcel} (longitud array=${
              Array.isArray(filaCruda) ? filaCruda.length : 'NO-ARRAY'
            }) ---`,
          );
          console.log(
            `[MIGRACION-DEBUG] fila CRUDA:`,
            JSON.stringify(filaCruda),
          );
          console.log(
            `[MIGRACION-DEBUG] extraídos -> fecha(idx ${col.fecha})=${depurarValor(
              filaCruda[col.fecha],
            )} | coche(idx ${col.coche})=${depurarValor(filaCruda[col.coche])} | bogie(idx ${
              col.bogie
            })=${depurarValor(filaCruda[col.bogie])} | eje(idx ${col.eje})=${depurarValor(
              filaCruda[col.eje],
            )} | h(idx ${col.h})=${depurarValor(filaCruda[col.h])} | t(idx ${col.t})=${depurarValor(
              filaCruda[col.t],
            )}`,
          );
          console.log(
            `[MIGRACION-DEBUG] veredicto esFilaVacia = ${esFilaVacia}`,
          );
        }

        if (esFilaVacia) {
          filasVaciasOmitidas++;
          continue;
        }

        // 2. Sin valores por defecto silenciosos: si H o T faltan en una fila
        // que SÍ tiene otros datos, es inválida (un 0 inventado generaría un
        // "Crítico" falso). No se inserta; se reporta.
        const hValue = aNumeroONull(filaCruda[col.h]);
        const tValue = aNumeroONull(filaCruda[col.t]);
        if (hValue === null || tValue === null) {
          filasInvalidas.push({
            hoja: nombreHoja,
            fila: filaExcel,
            motivo: 'Falta H o T',
          });
          continue;
        }

        // 3. Fecha segura: scan_records.fecha es NOT NULL. Una fecha inválida
        // no puede insertarse ni inventarse; se reporta y se sigue.
        const fecha = parsearFechaSegura(filaCruda[col.fecha]);
        if (fecha === null) {
          filasInvalidas.push({
            hoja: nombreHoja,
            fila: filaExcel,
            motivo: 'Fecha inválida o ausente',
          });
          continue;
        }

        // Kilometraje también es NOT NULL; sin default silencioso.
        const kilometraje = aNumeroONull(filaCruda[col.kilometraje]);
        if (kilometraje === null) {
          filasInvalidas.push({
            hoja: nombreHoja,
            fila: filaExcel,
            motivo: 'Falta kilometraje',
          });
          continue;
        }

        // Coche: normalizado (trim + mayúsculas + "R"/"R." -> "REM") y
        // validado contra el enum ANTES de guardar el borrador. Así ningún
        // valor sin normalizar (ni uno que no matchee el enum) llega a
        // scan_records: el commit ya no puede tronar por esto, y el filtro de
        // tipo de coche del frontend nunca ve "MA1"/"Ma1" como distintos.
        const cocheNormalizado = normalizarCoche(
          aTextoONull(filaCruda[col.coche]),
        );
        if (cocheNormalizado === null || !esTipoCocheValido(cocheNormalizado)) {
          filasInvalidas.push({
            hoja: nombreHoja,
            fila: filaExcel,
            motivo: `Tipo de coche inválido (${cocheNormalizado ?? 'vacío'})`,
          });
          continue;
        }

        // --- A partir de acá, lógica de negocio del prompt 3 (SIN CAMBIOS) ---
        const rdValue = evaluador.calcularRd(tValue, hValue);
        const estadoCalculado = evaluador.clasificarEstadoConReperfilado(
          rdValue,
          hValue,
        );

        // b. En libros históricos la hoja siempre manda. En tablas genéricas
        // (CSV/TSV/TXT/ODS/etc.) se usa la columna Tren.
        const trenExcel = aNumeroONull(filaCruda[col.tren]);
        const trenNumero = trenDeHoja ?? trenExcel;
        if (
          trenNumero === null ||
          !Number.isInteger(trenNumero) ||
          trenNumero < 6 ||
          trenNumero > 44
        ) {
          filasInvalidas.push({
            hoja: nombreHoja,
            fila: filaExcel,
            motivo: `Tren inválido (${trenExcel ?? 'vacío'}; se espera 6–44)`,
          });
          continue;
        }
        const corregidoPorHoja =
          trenDeHoja !== null && trenExcel !== null && trenExcel !== trenDeHoja;
        if (corregidoPorHoja) {
          detalleDiscrepancias.push({
            hoja: nombreHoja,
            filaExcel,
            tipo: 'tren',
            valorExcel: trenExcel,
            valorSistema: trenDeHoja,
          });
        }

        // d. Discrepancia de estado contra "Comentario". El cálculo del backend
        // siempre gana; esto es solo una advertencia informativa.
        const comentario = aTextoONull(filaCruda[col.comentario]);
        const estadoComentario = comentarioAEstado(comentario);
        const discrepanciaEstadoExcel =
          estadoComentario !== null && estadoComentario !== estadoCalculado;
        if (discrepanciaEstadoExcel) {
          detalleDiscrepancias.push({
            hoja: nombreHoja,
            filaExcel,
            tipo: 'estado',
            valorExcel: comentario,
            valorSistema: estadoCalculado,
          });
        }

        const bogieExcel = aTextoONull(filaCruda[col.bogie]);
        const ejeExcel = aNumeroONull(filaCruda[col.eje]);
        const ubicacionExcel = aTextoONull(filaCruda[col.ubicacion]);
        const ruedaExcel = aNumeroONull(filaCruda[col.rueda]);

        filas.push({
          responsableNombre: aTextoONull(filaCruda[col.responsable]) ?? '',
          trenNumero,
          kilometraje,
          fecha,
          motivo: aTextoONull(filaCruda[col.motivo]) ?? '',
          tValue,
          hValue,
          rdValue,
          estadoCalculado,
          estadoSugeridoExcel: comentario,
          hojaExcelOrigen: nombreHoja,
          trenOriginalExcel: corregidoPorHoja ? trenExcel : null,
          corregidoPorHoja,
          discrepanciaEstadoExcel,
          cocheExcel: cocheNormalizado,
          numeroCocheExcel: aNumeroONull(filaCruda[col.numeroCoche]),
          bogieExcel,
          ejeExcel,
          ubicacionExcel,
          ruedaExcel,
          ordenFisico: calcularOrdenFisico({
            tipoCoche: cocheNormalizado,
            bogieCodigo: bogieExcel,
            ejeNumero: ejeExcel,
            ruedaNumero: ruedaExcel,
          }),
        });
      } catch (err) {
        // Aislamiento: la fila problemática se reporta y el resto continúa.
        filasInvalidas.push({
          hoja: nombreHoja,
          fila: filaExcel,
          motivo: `Error al procesar la fila: ${mensajeError(err)}`,
        });
      }
    }

    hojasProcesadas.push(nombreHoja);
  }

  return {
    hojasProcesadas,
    hojasFaltantes,
    hojasConError,
    filas,
    totalFilasLeidas,
    filasVaciasOmitidas,
    filasInvalidas,
    detalleDiscrepancias,
  };
}
