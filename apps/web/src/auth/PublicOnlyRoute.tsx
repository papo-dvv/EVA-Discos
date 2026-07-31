import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

// Para /login: si ya hay sesión, no tiene sentido mostrar el formulario de
// nuevo — se manda a donde corresponda según el estado de esa sesión.
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { sesion } = useAuth()

  if (sesion) {
    return <Navigate to={sesion.forzarCambioPassword ? '/cambiar-password' : '/'} replace />
  }

  return <>{children}</>
}
