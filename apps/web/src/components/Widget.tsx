import type { ReactNode } from 'react'
import { GlassSurface } from './GlassSurface'

// Widget estilo Apple (styles.md §4.1): tile glass texturado con cabecera
// (glifo + etiqueta), valor grande protagonista y pie opcional. Es la unidad
// de composición primaria del dashboard (grilla bento).
type Estado = 'ok' | 'seguimiento' | 'cambio' | 'critico' | 'reperfilado'

const CLASE_ESTADO: Record<Estado, string> = {
  ok: 'glass-card--estado-ok',
  seguimiento: 'glass-card--estado-seguim',
  cambio: 'glass-card--estado-cambio',
  critico: 'glass-card--estado-critico',
  reperfilado: 'glass-card--estado-reperfilado',
}

type WidgetProps = {
  etiqueta: string
  glifo?: ReactNode
  valor?: ReactNode
  pie?: ReactNode
  tamano?: 's' | 'm' | 'l'
  estado?: Estado
  tilt?: boolean
  vivo?: boolean
  elevar?: boolean
  pulso?: boolean
  className?: string
  children?: ReactNode
}

export function Widget({
  etiqueta,
  glifo,
  valor,
  pie,
  tamano = 'm',
  estado,
  tilt = false,
  vivo = false,
  elevar = true,
  pulso = false,
  className = '',
  children,
}: WidgetProps) {
  const clases = [
    'eva-widget',
    `eva-widget--${tamano}`,
    estado && CLASE_ESTADO[estado],
    pulso && 'eva-anim-pulso',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <GlassSurface tilt={tilt} vivo={vivo} elevar={elevar} className={clases}>
      <div className="eva-widget__cabecera">
        {glifo && <span className="eva-widget__glifo">{glifo}</span>}
        <span>{etiqueta}</span>
      </div>
      {/* Si hay children se usa como cuerpo libre; si no, valor + pie estándar */}
      {children ?? (
        <>
          {valor !== undefined && <div className="eva-widget__valor">{valor}</div>}
          {pie && <div className="eva-widget__pie">{pie}</div>}
        </>
      )}
    </GlassSurface>
  )
}
