import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassButton } from '../components/GlassButton'
import { GlassSurface } from '../components/GlassSurface'
import { Marca } from '../components/Marca'
import { subirMigracion } from '../features/migration/api'
import { extraerMensajeError } from '../lib/extraerMensajeError'

// Entrada a la migración masiva: sube una tabla compatible y navega a la vista previa.
export function MigracionUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError(null);
    setCargando(true);
    try {
      const resumen = await subirMigracion(file);
      navigate(`/migracion/${resumen.fileId}`);
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo procesar el archivo."));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <GlassSurface fuerte iris className="w-full max-w-lg rounded-glass-lg p-8 sm:p-10">
        <Marca tono="oscuro" tamano="condensado" />
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-concreto-oscuro">
          Migración masiva
        </h1>
        <p className="mt-1.5 font-body text-sm text-concreto">
          Sube un archivo tabular para revisarlo antes de confirmar. Se admiten
          Excel, OpenDocument, CSV y texto delimitado.
        </p>

        <form onSubmit={onSubmit} className="mt-7">
          {/* Dropzone: el label envuelve el input file oculto */}
          <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-8 text-center transition-colors hover:border-[color:var(--color-verde-institucional)]">
            <span className="font-display text-3xl text-verde-oscuro">⇪</span>
            <span className="font-body text-sm font-semibold text-concreto-oscuro">
              {file ? file.name : "Elegir archivo tabular"}
            </span>
            <span className="font-body text-xs text-concreto">
              {file ? "Clic para cambiar" : "Clic para seleccionar"}
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xls,.xlsb,.xlsx,.xlsm,.ods"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-4 font-body text-sm text-[color:var(--color-estado-critico)]"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-4">
            <GlassButton type="submit" cargando={cargando} disabled={!file}>
              {cargando ? "Procesando…" : "Subir y revisar"}
            </GlassButton>
          </div>
        </form>
      </GlassSurface>
    </div>
  )
}
