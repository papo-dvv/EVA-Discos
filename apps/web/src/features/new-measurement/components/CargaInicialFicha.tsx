import { useState, type FormEvent } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { crearFichaManual, subirCsvMedicion } from '../api'

// Punto de entrada de una ficha nueva (motivo 'Medición'): subir el .csv de
// Nextsense/cpo (autocompleta todo el header) o registrar manualmente
// (requiere Tren + Kilometraje para poder crear el esqueleto de 48 filas
// vacías — ver CrearManualDto en el backend). Mismo lenguaje visual que
// MigracionUpload (dropzone), en un panel más chico porque vive embebido en
// la propia pantalla de Nuevas Mediciones, no en una ruta aparte.
type Props = {
  onCreada: (fichaId: string) => void
}

export function CargaInicialFicha({ onCreada }: Props) {
  const [modo, setModo] = useState<'csv' | 'manual'>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [trenNumero, setTrenNumero] = useState('')
  const [kilometraje, setKilometraje] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function subir(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setError(null)
    setCargando(true)
    try {
      const resumen = await subirCsvMedicion(file)
      onCreada(resumen.fichaId)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo procesar el archivo.'))
    } finally {
      setCargando(false)
    }
  }

  async function crearManual(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const resumen = await crearFichaManual({
        trenNumero: Number(trenNumero),
        kilometraje: Number(kilometraje),
      })
      onCreada(resumen.fichaId)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo crear la ficha.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div>
      <SegmentedControl
        ariaLabel="Origen de la ficha"
        opciones={[
          { valor: 'csv', etiqueta: 'Subir archivo .csv' },
          { valor: 'manual', etiqueta: 'Registrar manualmente' },
        ]}
        valor={modo}
        onCambiar={setModo}
      />

      {modo === 'csv' ? (
        <form onSubmit={subir} className="mt-5">
          <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-7 text-center transition-colors hover:border-[color:var(--color-verde-institucional)]">
            <span className="font-display text-2xl text-verde-oscuro">⇪</span>
            <span className="font-body text-sm font-semibold text-concreto-oscuro">
              {file ? file.name : 'Elegir archivo .csv'}
            </span>
            <span className="font-body text-xs text-concreto">
              {file ? 'Clic para cambiar' : 'Exportado de Nextsense/cpo'}
            </span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <GlassButton type="submit" cargando={cargando} disabled={!file}>
              {cargando ? 'Procesando…' : 'Subir y continuar'}
            </GlassButton>
          </div>
        </form>
      ) : (
        <form onSubmit={crearManual} className="mt-5">
          <div className="grid grid-cols-2 gap-3">
            <GlassField
              label="Tren"
              type="number"
              min={6}
              max={44}
              required
              value={trenNumero}
              onChange={(e) => setTrenNumero(e.target.value)}
            />
            <GlassField
              label="Kilometraje"
              type="number"
              step="any"
              required
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <GlassButton type="submit" cargando={cargando} disabled={!trenNumero || !kilometraje}>
              {cargando ? 'Creando…' : 'Crear ficha vacía'}
            </GlassButton>
          </div>
        </form>
      )}
    </div>
  )
}
