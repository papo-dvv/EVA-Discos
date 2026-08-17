import { LadoDisco, TipoCoche } from '../../generated/prisma';
import type {
  BrakeDiscRulesEngine,
  EstadoDiscoAmpliado,
} from '../brake-disc-rules/brake-disc-rules.engine';
import { calcularOrdenFisico } from '../common/orden-fisico';
import { resolverLado } from '../migration/migration-excel.parser';

// Parser puro del CSV "largo" de Nextsense/cpo (ficha de medición individual)
// — formato DISTINTO del .xlsm de la migración masiva. Sin Nest ni Prisma:
// recibe el texto crudo del archivo y un motor de reglas ya resuelto, y
// devuelve las filas listas para insertar + el resumen. Igual que
// migration-excel.parser.ts, disc_id NUNCA se resuelve acá (queda para el
// commit): solo se deja la identidad cruda (eje/lado/coche/bogie/rueda).

export const MOTIVO_MEDICION = 'Medición';
export const ACTIVIDAD_BAJO_BASTIDOR = 'BAJO BASTIDOR - TREN ALSTOM';

// Motivos que el prompt reconoce a futuro pero que este módulo NO implementa
// todavía — se validan acá para que el mensaje de rechazo sea uniforme entre
// el flujo de carga CSV y el de ingreso manual.
export const MOTIVOS_RECONOCIDOS = [
  'Medición',
  'Reperfilado',
  'Cambio',
] as const;
export type MotivoFicha = (typeof MOTIVOS_RECONOCIDOS)[number];

// Tolerancia para comparar el Rd que trae el CSV (Dimension.Name='Rd') contra
// el Rd recalculado por el backend (T-H) — solo para advertencia, nunca se
// confía en el valor del archivo (ver comentario de BrakeDiscRulesEngine).
const EPSILON_DISCREPANCIA_RD = 0.01;

// Rango de eje GLOBAL (1-24, sin transformación) -> tipo de coche + bogie.
// Verificado contra el archivo real (ver prompt): MA1 discos 1-4, MB1 5-8,
// MB3 9-12, REM 13-16, MB2 17-20, MA2 21-24. Debe coincidir siempre con
// PLAN_EJES_POR_COCHE (prisma/seed.ts) y ORDEN_BOGIE_POR_COCHE
// (common/orden-fisico.ts) — son la misma disposición física de la flota
// vista desde 3 ángulos distintos (siembra, orden de listado, y acá
// resolución de identidad por eje).
interface RangoEje {
  min: number;
  max: number;
  tipoCoche: TipoCoche;
  bogiePrimerPar: string;
  bogieSegundoPar: string;
}

const RANGOS_EJE_POR_COCHE: readonly RangoEje[] = [
  {
    min: 1,
    max: 4,
    tipoCoche: 'MA1',
    bogiePrimerPar: 'PB3',
    bogieSegundoPar: 'PB4',
  },
  {
    min: 5,
    max: 8,
    tipoCoche: 'MB1',
    bogiePrimerPar: 'PB6',
    bogieSegundoPar: 'PB2',
  },
  {
    min: 9,
    max: 12,
    tipoCoche: 'MB3',
    bogiePrimerPar: 'PB6',
    bogieSegundoPar: 'PB2',
  },
  {
    min: 13,
    max: 16,
    tipoCoche: 'REM',
    bogiePrimerPar: 'TB1',
    bogieSegundoPar: 'TB2',
  },
  {
    min: 17,
    max: 20,
    tipoCoche: 'MB2',
    bogiePrimerPar: 'PB2',
    bogieSegundoPar: 'PB6',
  },
  {
    min: 21,
    max: 24,
    tipoCoche: 'MA2',
    bogiePrimerPar: 'PB4',
    bogieSegundoPar: 'PB3',
  },
];

export interface IdentidadPorEje {
  tipoCoche: TipoCoche;
  bogieCodigo: string;
}

// Resuelve tipo de coche + bogie a partir del eje global (1-24). null si está
// fuera de rango (24 discos por tren, nunca más).
export function resolverIdentidadPorEje(
  ejeGlobal: number,
): IdentidadPorEje | null {
  const rango = RANGOS_EJE_POR_COCHE.find(
    (r) => ejeGlobal >= r.min && ejeGlobal <= r.max,
  );
  if (!rango) return null;
  const offset = ejeGlobal - rango.min; // 0-3 dentro del coche
  return {
    tipoCoche: rango.tipoCoche,
    bogieCodigo: offset < 2 ? rango.bogiePrimerPar : rango.bogieSegundoPar,
  };
}

// rueda_numero global 1-48: (2*N-1) si izquierdo, (2*N) si derecho — mismo
// criterio ya usado en prisma/seed.ts y en el resto del sistema.
export function resolverRuedaNumero(
  ejeGlobal: number,
  lado: LadoDisco,
): number {
  return lado === LadoDisco.derecho ? 2 * ejeGlobal : 2 * ejeGlobal - 1;
}

export interface MetadataFicha {
  measPlanName: string | null;
  trenNumero: number | null;
  kilometraje: number | null;
}

export interface FilaNuevaMedicion {
  ejeNumero: number; // global 1-24
  lado: LadoDisco;
  tipoCoche: TipoCoche;
  bogieCodigo: string;
  ruedaNumero: number;
  fecha: Date;
  tValue: number;
  hValue: number;
  rdValue: number; // SIEMPRE recalculado por el backend (T-H), nunca del CSV
  estadoCalculado: EstadoDiscoAmpliado;
  measPointNameOriginal: string;
}

export interface DiscrepanciaRd {
  measPointName: string;
  rdCsv: number;
  rdCalculado: number;
}

export interface FilaMedicionInvalida {
  measPointName: string;
  motivo: string;
}

export interface ResultadoParseoMedicion {
  metadata: MetadataFicha;
  filas: FilaNuevaMedicion[];
  filasInvalidas: FilaMedicionInvalida[];
  discrepanciasRd: DiscrepanciaRd[];
  // Filas totales que pasaron el filtro "disco_freno_* + H/T/Rd" (antes de
  // agrupar) — para el resumen de la carga.
  totalMedicionesLeidas: number;
}

function partirLinea(linea: string): string[] {
  return linea.split(';').map((v) => v.trim());
}

// Extrae el valor de una línea de metadata "Etiqueta;Valor" (mismo
// delimitador que el resto del archivo). Si no hay separador, se usa la
// línea completa tal cual — tolerante a variaciones del exportador.
function valorDeMetadata(linea: string): string {
  const partes = partirLinea(linea).filter((p) => p.length > 0);
  if (partes.length === 0) return '';
  return partes.length >= 2 ? partes.slice(1).join(';').trim() : partes[0];
}

function extraerEntero(texto: string): number | null {
  const match = /\d+/.exec(texto);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function extraerNumero(texto: string): number | null {
  // Tolera coma decimal (exportadores locales) y separadores de miles.
  const limpio = texto.replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) && limpio !== '' ? n : null;
}

// Meas.Date llega como YYYYMMDD (ej. "20260115"). Meas.Time (HHMMSS) se
// ignora al persistir: scan_records.fecha es DATE, no timestamp — ver
// comentario en NewMeasurementService. Se devuelve null (nunca Invalid Date)
// si el formato no calza, para que la fila se reporte como inválida.
function parsearFechaCompacta(yyyymmdd: string): Date | null {
  const texto = yyyymmdd.trim();
  if (!/^\d{8}$/.test(texto)) return null;
  const anio = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(4, 6));
  const dia = Number(texto.slice(6, 8));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

interface GrupoDisco {
  measPointName: string;
  ejeNumero: number;
  lado: LadoDisco;
  hValue: number | null;
  tValue: number | null;
  rdCsv: number | null;
  fecha: Date | null;
}

const DIMENSIONES_DISCO_FRENO = new Set(['h', 't', 'rd']);

export function procesarCsvMedicion(
  contenido: string,
  evaluador: BrakeDiscRulesEngine,
): ResultadoParseoMedicion {
  // Tolerante a CRLF/LF y a una línea final vacía.
  const lineas = contenido
    .split(/\r\n|\r|\n/)
    .filter((l, i, arr) => l.trim() !== '' || i < arr.length - 1);

  const metadata: MetadataFicha = {
    measPlanName: null,
    trenNumero: null,
    kilometraje: null,
  };
  if (lineas[0] !== undefined)
    metadata.measPlanName = valorDeMetadata(lineas[0]) || null;
  if (lineas[1] !== undefined)
    metadata.trenNumero = extraerEntero(valorDeMetadata(lineas[1]));
  if (lineas[2] !== undefined)
    metadata.kilometraje = extraerNumero(valorDeMetadata(lineas[2]));

  // La fila de encabezado de columnas (MeasObject.Name;MeasPoint.Name;...) es
  // opcional: se detecta por contenido (igual criterio que el parser de
  // migración) y se salta si está presente; si no está, los datos empiezan
  // igual justo después de las 3 líneas de metadata.
  let inicioDatos = 3;
  const posibleHeader =
    lineas[3] !== undefined
      ? partirLinea(lineas[3]).map((v) => v.toLowerCase())
      : [];
  if (
    posibleHeader[0]?.includes('measobject') &&
    posibleHeader[1]?.includes('measpoint')
  ) {
    inicioDatos = 4;
  }

  const grupos = new Map<string, GrupoDisco>();
  // measPointName -> motivo. Mapa (no array) para no duplicar el mismo error
  // 3 veces (una por cada fila H/T/Rd de un MeasPoint.Name malformado).
  const filasInvalidasCrudo = new Map<string, string>();
  let totalMedicionesLeidas = 0;

  for (let i = inicioDatos; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea.trim() === '') continue;
    const campos = partirLinea(linea);
    // campos[0] (MeasObject.Name) no se usa: la identidad real del coche se
    // resuelve por eje, no por este campo — ver resolverIdentidadPorEje.
    const measPointName = campos[1] ?? '';
    const dimensionName = campos[2] ?? '';
    const dimensionValue = campos[3] ?? '';
    const measDate = campos[5] ?? '';

    // Filtro obligatorio: SOLO disco_freno_N_lado, y SOLO H/T/Rd. Todo lo
    // demás (Rueda_N con FlHeight/FlThickness/qR, Punto_N con Dp/Dcr, u otra
    // Dimension.Name en un disco_freno) se ignora en silencio — no son
    // filas inválidas, son filas fuera de alcance por diseño.
    if (!measPointName.toLowerCase().startsWith('disco_freno_')) continue;
    const dimensionNormalizada = dimensionName.trim().toLowerCase();
    if (!DIMENSIONES_DISCO_FRENO.has(dimensionNormalizada)) continue;

    totalMedicionesLeidas++;

    const matchEje = /^disco_freno_(\d+)_/i.exec(measPointName.trim());
    const ejeNumero = matchEje ? Number(matchEje[1]) : null;
    if (ejeNumero === null || ejeNumero < 1 || ejeNumero > 24) {
      filasInvalidasCrudo.set(
        measPointName,
        `No se pudo extraer un número de eje válido (1-24) de "${measPointName}"`,
      );
      continue;
    }
    // matching por substring flexible (tolera "izquierdo"/"izquiero"/etc.):
    // resolverLado ya hace exactamente esto sobre el texto completo.
    const lado = resolverLado(measPointName, null);
    if (lado === null) {
      filasInvalidasCrudo.set(
        measPointName,
        `No se pudo determinar el lado (izquierdo/derecho) de "${measPointName}"`,
      );
      continue;
    }

    const valor = extraerNumero(dimensionValue);
    if (valor === null) continue; // celda vacía o no numérica: no aporta nada a este grupo

    const clave = `${ejeNumero}|${lado}`;
    const grupo: GrupoDisco = grupos.get(clave) ?? {
      measPointName,
      ejeNumero,
      lado,
      hValue: null,
      tValue: null,
      rdCsv: null,
      fecha: null,
    };
    if (dimensionNormalizada === 'h') grupo.hValue = valor;
    else if (dimensionNormalizada === 't') grupo.tValue = valor;
    else if (dimensionNormalizada === 'rd') grupo.rdCsv = valor;
    if (grupo.fecha === null) grupo.fecha = parsearFechaCompacta(measDate);
    grupos.set(clave, grupo);
  }

  const filas: FilaNuevaMedicion[] = [];
  const filasInvalidas: FilaMedicionInvalida[] = Array.from(
    filasInvalidasCrudo,
    ([measPointName, motivo]) => ({ measPointName, motivo }),
  );
  const discrepanciasRd: DiscrepanciaRd[] = [];

  for (const grupo of grupos.values()) {
    if (grupo.hValue === null || grupo.tValue === null) {
      const faltantes = [
        grupo.hValue === null ? 'H' : null,
        grupo.tValue === null ? 'T' : null,
      ]
        .filter((v): v is string => v !== null)
        .join(' y ');
      filasInvalidas.push({
        measPointName: grupo.measPointName,
        motivo: `Falta ${faltantes}`,
      });
      continue;
    }
    if (grupo.fecha === null) {
      filasInvalidas.push({
        measPointName: grupo.measPointName,
        motivo: 'Fecha inválida o ausente (Meas.Date)',
      });
      continue;
    }

    const identidad = resolverIdentidadPorEje(grupo.ejeNumero);
    if (identidad === null) {
      filasInvalidas.push({
        measPointName: grupo.measPointName,
        motivo: `Eje fuera de rango (${grupo.ejeNumero}, debe ser 1-24)`,
      });
      continue;
    }

    const rdValue = evaluador.calcularRd(grupo.tValue, grupo.hValue);
    const estadoCalculado = evaluador.clasificarEstadoConReperfilado(
      rdValue,
      grupo.hValue,
    );

    if (
      grupo.rdCsv !== null &&
      Math.abs(grupo.rdCsv - rdValue) > EPSILON_DISCREPANCIA_RD
    ) {
      discrepanciasRd.push({
        measPointName: grupo.measPointName,
        rdCsv: grupo.rdCsv,
        rdCalculado: rdValue,
      });
    }

    filas.push({
      ejeNumero: grupo.ejeNumero,
      lado: grupo.lado,
      tipoCoche: identidad.tipoCoche,
      bogieCodigo: identidad.bogieCodigo,
      ruedaNumero: resolverRuedaNumero(grupo.ejeNumero, grupo.lado),
      fecha: grupo.fecha,
      tValue: grupo.tValue,
      hValue: grupo.hValue,
      rdValue,
      estadoCalculado,
      measPointNameOriginal: grupo.measPointName,
    });
  }

  // Orden estable por identidad física (no por orden de aparición en el CSV).
  filas.sort(
    (a, b) =>
      calcularOrdenFisico({
        tipoCoche: a.tipoCoche,
        bogieCodigo: a.bogieCodigo,
        ejeNumero: a.ejeNumero,
        ruedaNumero: a.ruedaNumero,
      }) -
      calcularOrdenFisico({
        tipoCoche: b.tipoCoche,
        bogieCodigo: b.bogieCodigo,
        ejeNumero: b.ejeNumero,
        ruedaNumero: b.ruedaNumero,
      }),
  );

  return {
    metadata,
    filas,
    filasInvalidas,
    discrepanciasRd,
    totalMedicionesLeidas,
  };
}
