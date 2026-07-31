import type { ReactNode } from 'react'

// Shell de fondo de pantalla (styles.md §7). Siempre .bg-aura + .bg-cuadricula.
// Con `degradado`, suma la capa de transformación tierra→verde difuminada por
// abajo (pantallas de entrada: login, cambio de contraseña, subida).
type PantallaFondoProps = {
  degradado?: boolean
  centrado?: boolean
  className?: string
  children?: ReactNode
}

export function PantallaFondo({
  degradado = false,
  centrado = false,
  className = '',
  children,
}: PantallaFondoProps) {
  return (
    <div
      className={`bg-aura bg-cuadricula relative min-h-screen overflow-hidden ${
        centrado ? 'flex items-center justify-center' : ''
      } ${className}`.trim()}
    >
      {degradado && (
        <div className="bg-degradado-transformacion bg-difuminado-inferior pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]" />
      )}
      {children}
    </div>
  )
}
