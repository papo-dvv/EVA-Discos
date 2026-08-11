const CLAVES = {
  medicion: 'eva.ficha-activa.medicion',
  reperfilado: 'eva.ficha-activa.reperfilado',
} as const

export type TipoFichaActiva = keyof typeof CLAVES

export function obtenerFichaActiva(tipo: TipoFichaActiva): string | null {
  return localStorage.getItem(CLAVES[tipo])
}

export function guardarFichaActiva(tipo: TipoFichaActiva, fichaId: string): void {
  localStorage.setItem(CLAVES[tipo], fichaId)
}

export function limpiarFichaActiva(tipo: TipoFichaActiva): void {
  localStorage.removeItem(CLAVES[tipo])
}
