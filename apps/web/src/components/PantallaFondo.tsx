import type { ReactNode } from 'react'
import { FondoEngranajes } from './FondoEngranajes'

// Shell de fondo de pantalla (styles.md §7.1). Fondo animado de engranajes
// cayendo en todas las pantallas de todos los módulos. Con `degradado`, suma
// la capa de transformación tierra→verde difuminada por abajo (pantallas de
// entrada: login, cambio de contraseña, subida).
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
    <FondoEngranajes
      className={`relative min-h-screen ${centrado ? 'flex items-center justify-center' : ''} ${className}`.trim()}
    >
      {degradado && (
        <div className="bg-degradado-transformacion bg-difuminado-inferior pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]" />
      )}
      {children}
    </FondoEngranajes>
  )
}
