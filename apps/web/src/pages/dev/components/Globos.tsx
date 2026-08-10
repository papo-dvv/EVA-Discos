import type { ReactNode } from 'react'

// RUTA TEMPORAL DE DESARROLLO — eliminar tras periodo de pruebas de UI.
// Exploración visual del tratamiento Liquid Glass (.glass-surface, styles.md
// §4) aplicado a "globos" de comentario/estado — disc_comments todavía no
// existe como módulo, así que todo el contenido acá es ficticio, solo para
// revisión de estilo.

type GloboComentarioProps = {
  autor: string
  iniciales: string
  cuando: string
  children: ReactNode
}

export function GloboComentario({ autor, iniciales, cuando, children }: GloboComentarioProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verde-claro font-body text-xs font-semibold text-verde-oscuro">
        {iniciales}
      </div>
      <div className="dev-globo dev-globo--comentario relative">
        <div className="glass-surface max-w-sm rounded-glass-sm px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-body text-sm font-semibold text-concreto-oscuro">{autor}</span>
            <span className="font-body text-[11px] text-concreto">{cuando}</span>
          </div>
          <p className="mt-1 font-body text-sm text-concreto-oscuro">{children}</p>
        </div>
      </div>
    </div>
  )
}

type EstadoGlobo = 'ok' | 'seguimiento' | 'cambio' | 'critico' | 'reperfilado'

const CLASE_BORDE_ESTADO: Record<EstadoGlobo, string> = {
  ok: 'glass-card--estado-ok',
  seguimiento: 'glass-card--estado-seguim',
  cambio: 'glass-card--estado-cambio',
  critico: 'glass-card--estado-critico',
  reperfilado: 'glass-card--estado-reperfilado',
}

type GloboEstadoProps = {
  estado: EstadoGlobo
  disco: string
  texto: string
}

export function GloboEstado({ estado, disco, texto }: GloboEstadoProps) {
  return (
    <div
      className={`glass-surface ${CLASE_BORDE_ESTADO[estado]} dev-globo dev-globo--estado relative inline-flex items-center gap-2 rounded-full px-4 py-2`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: `var(--color-estado-${estado})` }}
        aria-hidden="true"
      />
      <span className="font-data text-xs font-semibold text-concreto-oscuro">{disco}</span>
      <span className="font-body text-xs text-concreto">{texto}</span>
    </div>
  )
}
