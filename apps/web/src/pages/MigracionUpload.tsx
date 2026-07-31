import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { Marca } from '../components/Marca'
import { PantallaFondo } from '../components/PantallaFondo'
import { subirMigracion } from '../features/migration/api'
import { extraerMensajeError } from '../lib/extraerMensajeError'

// Entrada a la migración masiva: sube el .xlsx/.xlsm y navega a la vista previa.
export function MigracionUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setError(null)
    setCargando(true)
    try {
      const resumen = await subirMigracion(file)
      navigate(`/migracion/${resumen.fileId}`)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo procesar el archivo.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <PantallaFondo degradado centrado className="px-6 py-16">
      <GlassSurface fuerte iris className="w-full max-w-lg rounded-glass-lg p-8 sm:p-10">
        <Marca tono="oscuro" tamano="condensado" />
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-concreto-oscuro">
          Migración masiva
        </h1>
        <p className="mt-1.5 font-body text-sm text-concreto">
          Sube el archivo histórico (.xlsx o .xlsm con las hojas T06–T44) para revisarlo antes de confirmar.
        </p>

        <form onSubmit={onSubmit} className="mt-7">
          {/* Dropzone: el label envuelve el input file oculto */}
          <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-8 text-center transition-colors hover:border-[color:var(--color-verde-institucional)]">
            <span className="font-display text-3xl text-verde-oscuro">⇪</span>
            <span className="font-body text-sm font-semibold text-concreto-oscuro">
              {file ? file.name : 'Elegir archivo .xlsx o .xlsm'}
            </span>
            <span className="font-body text-xs text-concreto">
              {file ? 'Clic para cambiar' : 'Clic para seleccionar'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && (
            <p role="alert" className="mt-4 font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="font-body text-xs text-concreto underline underline-offset-2 transition-colors hover:text-concreto-oscuro"
            >
              ← Volver al inicio
            </Link>
            <GlassButton type="submit" cargando={cargando} disabled={!file}>
              {cargando ? 'Procesando…' : 'Subir y revisar'}
            </GlassButton>
          </div>
        </form>
      </GlassSurface>
    </PantallaFondo>
  )
}
