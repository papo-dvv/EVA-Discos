import type { Fabricante } from '../../inventory/types'

export type FabricanteTren = 'ALSTOM' | 'ANSALDO'

// Puente hacia el enum real de Train.modelo (ModeloTren en el backend, mismo
// valor que BrakeDisc.fabricante en Inventario) — el toggle del dashboard usa
// las siglas cortas, pero los endpoints filtran por el valor completo.
export const FABRICANTE_TREN_A_MODELO: Record<FabricanteTren, Fabricante> = {
  ALSTOM: 'alstom_metropolis9000',
  ANSALDO: 'ansaldo_mb300',
}

export function fabricanteDeTren(tren: number): FabricanteTren {
  // Ansaldo cubre los trenes 1-5, Alstom 6-44. Hoy la flota Ansaldo no tiene
  // catálogo sembrado (useFleetSummary nunca devuelve esos trenes), así que
  // en la práctica siempre pinta Alstom; queda listo para cuando exista.
  return tren <= 5 ? 'ANSALDO' : 'ALSTOM'
}

export const FABRICANTE_CLASES: Record<FabricanteTren, string> = {
  ALSTOM: 'border-verde-institucional/35 bg-verde-claro text-verde-oscuro',
  ANSALDO: 'border-red-300 bg-red-100 text-red-800',
}

// Variante en píldora sólida (bg de color + texto blanco) — usada en
// TrenSemaforoCard (Mediciones), a diferencia del badge con borde suave de
// FABRICANTE_CLASES (TrainFrontCard de Flota).
export const FABRICANTE_PILDORA: Record<FabricanteTren, string> = {
  ALSTOM: 'bg-verde-institucional text-white',
  ANSALDO: 'bg-red-600 text-white',
}
