import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'

// RUTA TEMPORAL DE DESARROLLO — eliminar tras periodo de pruebas de UI.
// Variante experimental de .bg-engranajes-cayendo (styles.md §7.1): en vez de
// fórmulas escalonadas por índice, cada instancia sale de un PRNG con semilla
// (mulberry32) — misma semilla = mismo layout, útil para reproducir/debuggear
// un arreglo puntual. Ícono de tuerca dibujado inline (no toca public/icons.svg,
// que es un asset compartido con el resto de la app).
function mulberry32(semilla: number) {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TuercaInstancia {
  left: string
  size: number
  opacidad: number
  duracion: number
  giro: number
  retraso: number
}

// Rangos deliberadamente más anchos que .bg-engranajes-cayendo (16-52px en 3
// pasos fijos) para que el tamaño y la velocidad se sientan continuos, no
// escalonados.
function crearTuercas(cantidad: number, semilla: number): TuercaInstancia[] {
  const azar = mulberry32(semilla)
  return Array.from({ length: cantidad }, () => ({
    left: `${(azar() * 130 - 14).toFixed(1)}%`,
    size: Math.round(12 + azar() * 38), // 12-50px
    opacidad: Number((0.07 + azar() * 0.13).toFixed(2)), // 0.07-0.20
    duracion: Number((13 + azar() * 24).toFixed(1)), // 13-37s
    giro: Number((4 + azar() * 12).toFixed(1)), // 4-16s
    retraso: Number((-(azar() * 36)).toFixed(1)), // ya en curso al montar
  }))
}

function IconoTuerca() {
  // Tuerca hexagonal con el hueco roscado — mismo trazo (currentColor,
  // stroke-width 1.6) que #gear-icon en public/icons.svg, para que ambas
  // variantes se sientan del mismo lenguaje visual al compararse.
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 2.5 20.2 7.3v9.4L12 21.5 3.8 16.7V7.3z"
      />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

type FondoTuercasProps = {
  cantidad?: number
  semilla?: number
  className?: string
  children?: ReactNode
}

export function FondoTuercas({ cantidad = 30, semilla = 7, className = '', children }: FondoTuercasProps) {
  const tuercas = useMemo(() => crearTuercas(cantidad, semilla), [cantidad, semilla])

  return (
    <div className={`dev-bg-tuercas-cayendo dev-bg-cuadricula-densa ${className}`.trim()}>
      {tuercas.map((t, i) => (
        <span
          key={i}
          className="dev-tuerca"
          style={
            {
              left: t.left,
              '--size': `${t.size}px`,
              '--opacidad': t.opacidad,
              '--duracion': `${t.duracion}s`,
              '--giro': `${t.giro}s`,
              '--retraso': `${t.retraso}s`,
            } as CSSProperties
          }
        >
          <IconoTuerca />
        </span>
      ))}
      {children}
    </div>
  )
}
