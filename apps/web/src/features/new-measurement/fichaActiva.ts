const CLAVES = {
  medicion: 'eva.ficha-activa.medicion',
  reperfilado: 'eva.ficha-activa.reperfilado',
} as const

export type TipoFichaActiva = keyof typeof CLAVES

// sessionStorage a propósito (antes localStorage): "volver a la última
// ficha" solo debe sobrevivir dentro de la misma pestaña/sesión del
// navegador — al cerrar el navegador (o al otro día) /nuevas-mediciones debe
// dejar al usuario en la pantalla base, no reabrir sola una ficha vieja. Una
// URL directa con id (compartida/guardada) sigue abriendo esa ficha si
// todavía existe — esto solo afecta el auto-redirect desde la ruta sin id.
export function obtenerFichaActiva(tipo: TipoFichaActiva): string | null {
  return sessionStorage.getItem(CLAVES[tipo])
}

export function guardarFichaActiva(
  tipo: TipoFichaActiva,
  fichaId: string,
): void {
  sessionStorage.setItem(CLAVES[tipo], fichaId)
}

export function limpiarFichaActiva(tipo: TipoFichaActiva): void {
  sessionStorage.removeItem(CLAVES[tipo])
}
