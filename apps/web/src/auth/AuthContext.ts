import { createContext } from 'react'

export type Usuario = {
  id: string
  nombresCompletos: string
  email: string
  rol: string
}

// Espejo de LoginResult del backend (apps/api/src/auth/auth.service.ts).
export type SesionAuth = {
  accessToken: string
  forzarCambioPassword: boolean
  usuario: Usuario
}

export type AuthContextValue = {
  sesion: SesionAuth | null
  login: (email: string, password: string) => Promise<void>
  cambiarPasswordObligatorio: (newPassword: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
