export const TRENES_ALSTOM = Array.from({ length: 39 }, (_, i) => i + 6);
export const TRENES_ANSALDO = Array.from({ length: 5 }, (_, i) => i + 1);

// Pseudo-tren "Reserva" (ver schema.prisma, Train.numero=0) — nunca entra al
// grid de trenes de Flota (no es un tren en servicio), pero sus coches/discos
// sí existen en el catálogo (Inventario/Mediciones).
export const TREN_RESERVA = 0;

// Todos los trenes reales con catálogo sembrado (Alstom + Ansaldo), excluye
// el pseudo-tren Reserva.
export const TRENES_FLOTA = [...TRENES_ANSALDO, ...TRENES_ALSTOM];

export const ORDEN_COCHE_FLOTA = [
  'MA1',
  'MB1',
  'MB3',
  'REM',
  'MB2',
  'MA2',
] as const;

export const ORDEN_BOGIE_POR_COCHE_FLOTA = {
  MA1: ['PB3', 'PB4'],
  MB1: ['PB6', 'PB2'],
  MB3: ['PB6', 'PB2'],
  REM: ['TB1', 'TB2'],
  MB2: ['PB2', 'PB6'],
  MA2: ['PB4', 'PB3'],
} as const;

// Ansaldo: a diferencia de Alstom (un coche por tipo), cada tipo aparece 2
// veces por tren (2xM20, 2xM21, 2xM22) — ver flota.md. El orden de tarjetas
// en Flota se arma por tipo (este orden) y dentro de cada tipo por N° de
// coche ascendente, no por un mapeo 1:1 tipo->coche como en Alstom.
export const ORDEN_COCHE_ANSALDO = ['M20', 'M21', 'M22'] as const;

// Ansaldo: catálogo de bogies fijo por tipo de coche (mismo patrón que
// ORDEN_BOGIE_POR_COCHE_FLOTA), reutilizado por las 2 unidades de cada tipo
// dentro de un mismo tren — ver prisma/seed.ts (seedFlotaAnsaldo).
export const ORDEN_BOGIE_POR_COCHE_ANSALDO = {
  M20: ['C1', 'C2'],
  M21: ['C3', 'C4'],
  M22: ['C5', 'C6'],
} as const;

export const LADOS_DISCO_FLOTA = ['izquierdo', 'derecho'] as const;

// unica para Alstom (un disco por lado); interior/exterior para Ansaldo (2
// discos por lado) — ver enum PosicionDisco en schema.prisma.
export const POSICIONES_DISCO_ALSTOM = ['unica'] as const;
export const POSICIONES_DISCO_ANSALDO = ['interior', 'exterior'] as const;

export type CocheFlota = (typeof ORDEN_COCHE_FLOTA)[number];
export type CocheFlotaAnsaldo = keyof typeof ORDEN_BOGIE_POR_COCHE_ANSALDO;
