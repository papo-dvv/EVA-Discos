import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

type RequireAuthProps = {
  children: ReactNode
  // false solo en la ruta de cambio de contraseña obligatorio: ahí SÍ se
  // permite entrar aunque forzarCambioPassword esté activo (es la única
  // ruta a la que puede navegar mientras esté pendiente).
  requireNotForzado?: boolean
}

export function RequireAuth({ children, requireNotForzado = true }: RequireAuthProps) {
  const { sesion } = useAuth()
  const location = useLocation()

  if (!sesion) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireNotForzado && sesion.forzarCambioPassword) {
    return <Navigate to="/cambiar-password" replace />
  }

  return <>{children}</>
}
