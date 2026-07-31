import { utils, type WorkBook } from 'xlsx';

// Construye un workbook de prueba con hojas T06 y T07 (y hojas fuera de rango
// que deben ignorarse). Compartido por el generador de .xlsx en disco y por
// los tests del parser, para que ambos usen exactamente los mismos datos.
//
// Con los umbrales por defecto (rd_ok=1.00, rd_seguimiento=0.40):
//   rd = T - H  ->  >=1.0 OK | (0.4,1.0) SEGUIMIENTO | (0,0.4] CAMBIO | <=0 CRITICO

// Encabezados de la fila 2. Incluye las columnas de validación cruzada
// (T-H, Comentario) y las que deben ignorarse por completo (Medición,
// Nueva Proyección, Comentario 2).
const ENCABEZADOS = [
  'Responsable',
  'Tren',
  'Kilometraje',
  'Fecha',
  'Motivo',
  'Coche',
  'N° Coche',
  'Bogie',
  'Eje',
  'Ubicación',
  'Rueda',
  'H',
  'T',
  'T-H',
  'Comentario',
  'Medición',
  'Nueva Proyección',
  'Comentario 2',
];

interface DatosFila {
  responsable: string;
  tren: number;
  kilometraje: number;
  fecha: string;
  motivo: string;
  coche: string;
  numeroCoche: number;
  bogie: string;
  eje: number;
  ubicacion: string;
  rueda: number;
  h: number;
  t: number;
  comentario: string;
}

function fila(d: DatosFila): unknown[] {
  return [
    d.responsable,
    d.tren,
    d.kilometraje,
    d.fecha,
    d.motivo,
    d.coche,
    d.numeroCoche,
    d.bogie,
    d.eje,
    d.ubicacion,
    d.rueda,
    d.h,
    d.t,
    // T-H de la planilla: a propósito con un valor "mentiroso" (999) para
    // demostrar que el backend NUNCA lo usa como fuente de cálculo.
    999,
    d.comentario,
    // Columnas ignoradas por completo (basura a propósito):
    'IGNORAR-medicion',
    'IGNORAR-proyeccion',
    'IGNORAR-comentario2',
  ];
}

// Filas de T06 (tren de hoja = 6). Ver aserciones en migration-excel.parser.spec.ts.
const FILAS_T06: DatosFila[] = [
  // OK, tren coincide, comentario coincide -> sin advertencia
  {
    responsable: 'Juan Pérez',
    tren: 6,
    kilometraje: 125000.5,
    fecha: '2024-01-15',
    motivo: 'Medición',
    coche: 'MA1',
    numeroCoche: 129,
    bogie: 'PB2',
    eje: 1,
    ubicacion: 'izquierdo',
    rueda: 1,
    h: 3.8,
    t: 12.4,
    comentario: 'OK',
  },
  // SEGUIMIENTO (rd=0.7)
  {
    responsable: 'Ana Torres',
    tren: 6,
    kilometraje: 125010,
    fecha: '2024-01-15',
    motivo: 'Medición',
    coche: 'MA1',
    numeroCoche: 129,
    bogie: 'PB2',
    eje: 1,
    ubicacion: 'derecho',
    rueda: 2,
    h: 5.0,
    t: 5.7,
    comentario: 'Seguimiento',
  },
  // CAMBIO (rd=0.2)
  {
    responsable: 'Ana Torres',
    tren: 6,
    kilometraje: 125010,
    fecha: '2024-01-16',
    motivo: 'Medición',
    coche: 'MB1',
    numeroCoche: 130,
    bogie: 'PB3',
    eje: 2,
    ubicacion: 'izquierdo',
    rueda: 3,
    h: 5.0,
    t: 5.2,
    comentario: 'Cambio',
  },
  // CRITICO (rd=-4.9)
  {
    responsable: 'Luis Ríos',
    tren: 6,
    kilometraje: 125020,
    fecha: '2024-01-16',
    motivo: 'Verificación cambio',
    coche: 'MB1',
    numeroCoche: 130,
    bogie: 'PB3',
    eje: 2,
    ubicacion: 'derecho',
    rueda: 4,
    h: 7.9,
    t: 3.0,
    comentario: 'Crítico',
  },
  // Discrepancia de ESTADO: calcula OK (rd=8.6) pero la planilla dice "Cambio"
  {
    responsable: 'Luis Ríos',
    tren: 6,
    kilometraje: 125030,
    fecha: '2024-01-17',
    motivo: 'Medición',
    coche: 'REM',
    numeroCoche: 508,
    bogie: 'TB1',
    eje: 1,
    ubicacion: 'izquierdo',
    rueda: 5,
    h: 3.8,
    t: 12.4,
    comentario: 'Cambio',
  },
  // Discrepancia de TREN: la fila dice 99 pero la hoja es T06 -> se corrige a 6
  {
    responsable: 'María Sánchez',
    tren: 99,
    kilometraje: 125040,
    fecha: '2024-01-17',
    motivo: 'Medición',
    coche: 'REM',
    numeroCoche: 508,
    bogie: 'TB1',
    eje: 1,
    ubicacion: 'derecho',
    rueda: 6,
    h: 3.8,
    t: 12.4,
    comentario: 'OK',
  },
];

// Filas de T07 (tren de hoja = 7).
const FILAS_T07: DatosFila[] = [
  // OK, tren coincide
  {
    responsable: 'Pedro Gómez',
    tren: 7,
    kilometraje: 98000,
    fecha: '2024-02-01',
    motivo: 'Medición',
    coche: 'MA2',
    numeroCoche: 408,
    bogie: 'PB6',
    eje: 3,
    ubicacion: 'izquierdo',
    rueda: 7,
    h: 2.0,
    t: 4.0,
    comentario: 'OK',
  },
  // Discrepancia de TREN: la fila dice 6 pero la hoja es T07 -> se corrige a 7
  {
    responsable: 'Pedro Gómez',
    tren: 6,
    kilometraje: 98010,
    fecha: '2024-02-01',
    motivo: 'Medición',
    coche: 'MA2',
    numeroCoche: 408,
    bogie: 'PB6',
    eje: 3,
    ubicacion: 'derecho',
    rueda: 8,
    h: 6.7,
    t: 6.9,
    comentario: 'Cambio',
  },
];

function construirHoja(filas: DatosFila[]): unknown[][] {
  return [
    ['Panel Principal'], // fila 1: se ignora
    ENCABEZADOS, // fila 2: encabezados
    ...filas.map(fila), // fila 3+: datos
  ];
}

export function construirWorkbookPrueba(): WorkBook {
  const workbook = utils.book_new();

  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(construirHoja(FILAS_T06)),
    'T06',
  );
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(construirHoja(FILAS_T07)),
    'T07',
  );

  // Hojas que el parser debe ignorar: fuera del rango T06–T44.
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([['Resumen general']]),
    'Resumen',
  );
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(construirHoja(FILAS_T06)),
    'T05',
  );

  return workbook;
}
