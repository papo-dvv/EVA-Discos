import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { apiClient } from '../lib/apiClient'
import { AuthContext, type SesionAuth } from './AuthContext'

const STORAGE_KEY = 'eva.sesion'

function leerSesionGuardada(): SesionAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SesionAuth) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionAuth | null>(() => leerSesionGuardada())

  const guardar = useCallback((nuevaSesion: SesionAuth | null) => {
    setSesion(nuevaSesion)
    if (nuevaSesion) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaSesion))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post<SesionAuth>('/auth/login', { email, password })
      guardar(data)
    },
    [guardar],
  )

  const cambiarPasswordObligatorio = useCallback(
    async (newPassword: string) => {
      if (!sesion) throw new Error('No hay una sesión activa.')
      await apiClient.post(
        '/auth/change-password',
        { newPassword },
        { headers: { Authorization: `Bearer ${sesion.accessToken}` } },
      )
      guardar({ ...sesion, forzarCambioPassword: false })
    },
    [sesion, guardar],
  )

  const logout = useCallback(() => guardar(null), [guardar])

  const value = useMemo(
    () => ({ sesion, login, cambiarPasswordObligatorio, logout }),
    [sesion, login, cambiarPasswordObligatorio, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
