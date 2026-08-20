export const TRENES_ALSTOM = Array.from({ length: 39 }, (_, i) => i + 6);

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

export const LADOS_DISCO_FLOTA = ['izquierdo', 'derecho'] as const;

export type CocheFlota = (typeof ORDEN_COCHE_FLOTA)[number];
