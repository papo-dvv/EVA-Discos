// Vida Útil — % derivado del espesor T de cada lado, nunca persistido (ver
// plan de Operaciones: no hay campo de negocio real detrás, es puramente
// informativo para priorizar qué retirar). Un disco recién dado de alta sin
// medición aún se asume nuevo al 100% (T=7.00mm, mismo placeholder que usa
// Cambio de Disco al instalar una pieza).
export const T_NUEVO_MM = 7.0

export function vidaUtilPorcentaje(tIzq: number | null, tDer: number | null): number {
  const t = tIzq ?? T_NUEVO_MM
  const d = tDer ?? T_NUEVO_MM
  return Math.max(0, Math.min(100, (Math.min(t, d) / T_NUEVO_MM) * 100))
}
