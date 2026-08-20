import type { EstadoDisco } from '../../scan-records/types'

export const ESTADO_META: Record<
  EstadoDisco,
  { etiqueta: string; chipClass: string; cssVar: string; textVar: string }
> = {
  OK: {
    etiqueta: 'OK',
    chipClass: 'tabla-chip--ok',
    cssVar: 'var(--color-estado-ok)',
    textVar: 'var(--tabla-estado-ok-text)',
  },
  SEGUIMIENTO: {
    etiqueta: 'Seguimiento',
    chipClass: 'tabla-chip--seguimiento',
    cssVar: 'var(--color-estado-seguimiento)',
    textVar: 'var(--tabla-estado-seguimiento-text)',
  },
  CAMBIO: {
    etiqueta: 'Cambio',
    chipClass: 'tabla-chip--cambio',
    cssVar: 'var(--color-estado-cambio)',
    textVar: 'var(--tabla-estado-cambio-text)',
  },
  CRITICO: {
    etiqueta: 'Crítico',
    chipClass: 'tabla-chip--critico',
    cssVar: 'var(--color-estado-critico)',
    textVar: 'var(--tabla-estado-critico-text)',
  },
  REPERFILADO: {
    etiqueta: 'Reperfilado',
    chipClass: 'tabla-chip--reperfilado',
    cssVar: 'var(--color-estado-reperfilado)',
    textVar: 'var(--tabla-accion-reperfilado-text)',
  },
}

export function colorEstado(estado: EstadoDisco | null): string {
  return estado ? ESTADO_META[estado].cssVar : 'var(--color-concreto)'
}
