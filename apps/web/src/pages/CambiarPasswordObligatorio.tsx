import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassButton } from '../components/GlassButton'
import { GlassField } from '../components/GlassField'
import { GlassSurface } from '../components/GlassSurface'
import { Marca } from '../components/Marca'
import { PantallaFondo } from '../components/PantallaFondo'
import { useAuth } from '../auth/useAuth'
import { extraerMensajeError } from '../lib/extraerMensajeError'

// Se muestra cuando el login devuelve forzarCambioPassword=true. RequireAuth
// (ver src/auth/RequireAuth.tsx) bloquea cualquier otra ruta hasta que esta
// pantalla se complete — no hay forma de "saltarla" navegando directo a "/".
export function CambiarPasswordObligatorio() {
  const { sesion, cambiarPasswordObligatorio, logout } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      await cambiarPasswordObligatorio(newPassword)
      navigate('/', { replace: true })
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo cambiar la contraseña.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <PantallaFondo degradado centrado className="px-6 py-16">
      <GlassSurface fuerte vivo iris className="w-full max-w-md rounded-glass-lg p-8 sm:p-10">
        <Marca tono="oscuro" />
        <h1 className="mt-7 font-display text-2xl font-semibold tracking-tight text-concreto-oscuro">
          Cambio de contraseña obligatorio
        </h1>
        <p className="mt-1.5 font-body text-sm text-concreto">
          Hola {sesion?.usuario.nombresCompletos}. Antes de continuar necesitas definir una
          contraseña nueva.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <GlassField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <GlassField
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && (
            <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}
          <GlassButton type="submit" cargando={cargando} bloque className="mt-2">
            {cargando ? 'Guardando…' : 'Cambiar contraseña'}
          </GlassButton>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-5 w-full font-body text-xs text-concreto underline underline-offset-2 transition-colors hover:text-concreto-oscuro"
        >
          Cerrar sesión
        </button>
      </GlassSurface>
    </PantallaFondo>
  )
}
