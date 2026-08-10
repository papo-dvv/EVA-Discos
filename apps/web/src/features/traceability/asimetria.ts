import type { ClasificacionAsimetria } from './types'

// Vocabulario compartido entre PanelEstadisticasTrazabilidad (tarjeta
// "Asimetría") y PanelMetodosTrazabilidad (nota sobre por qué el límite y el
// extremo de consenso pueden verse asimétricos) — una sola fuente para no
// desincronizar el texto entre los dos paneles.

export const ETIQUETA_ASIMETRIA: Record<ClasificacionAsimetria, string> = {
  SIMETRICA: 'Simétrica',
  SESGO_POSITIVO: 'Sesgo positivo',
  SESGO_NEGATIVO: 'Sesgo negativo',
}

// Flecha/barra inclinada hacia el lado del sesgo — nunca los colores
// semánticos de estado de disco (OK/Cambio/Crítico): esto es una propiedad
// de la distribución, no un estado de salud del disco.
export const GLIFO_ASIMETRIA: Record<ClasificacionAsimetria, string> = {
  SIMETRICA: '≈',
  SESGO_POSITIVO: '→',
  SESGO_NEGATIVO: '←',
}

// Lectura en el dominio de desgaste de discos (tasaMensual), no la
// definición estadística cruda.
export const DESCRIPCION_ASIMETRIA: Record<ClasificacionAsimetria, string> = {
  SIMETRICA:
    'Las tasas de desgaste limpias se reparten parejo a ambos lados del promedio, sin sesgo marcado hacia casos rápidos ni lentos.',
  SESGO_POSITIVO:
    'La mayoría de los discos desgastan a tasas bajas, con algunos casos puntuales de desgaste mucho más rápido que el resto.',
  SESGO_NEGATIVO:
    'La mayoría de los discos desgastan a tasas altas, con algunos casos puntuales de desgaste mucho más lento que el resto.',
}
