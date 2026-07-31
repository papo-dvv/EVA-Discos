import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassButton } from '../components/GlassButton'
import { GlassField } from '../components/GlassField'
import { GlassSurface } from '../components/GlassSurface'
import { Marca } from '../components/Marca'
import { PantallaFondo } from '../components/PantallaFondo'
import { useAuth } from '../auth/useAuth'
import { extraerMensajeError } from '../lib/extraerMensajeError'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await login(email, password)
      // RequireAuth decide si esto termina en "/" o en "/cambiar-password"
      // según forzarCambioPassword.
      navigate('/', { replace: true })
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo iniciar sesión.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <PantallaFondo degradado centrado className="px-6 py-16">
      {/* Card hero de la pantalla: la única con --vivo + iris + tilt (§4/§4.1). */}
      <GlassSurface fuerte vivo iris tilt className="w-full max-w-md rounded-glass-lg p-8 sm:p-10">
        <Marca tono="oscuro" />
        <h1 className="mt-7 font-display text-3xl font-semibold tracking-tight text-concreto-oscuro">
          Iniciar sesión
        </h1>
        <p className="mt-1.5 font-body text-sm text-concreto">
          Ingresa con tu cuenta institucional para continuar.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <GlassField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <GlassField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}
          <GlassButton type="submit" cargando={cargando} bloque className="mt-2">
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </GlassButton>
        </form>
      </GlassSurface>
    </PantallaFondo>
  )
}
