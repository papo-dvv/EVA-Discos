import { useRef, useState, type FormEvent } from 'react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { crearFichaManual, subirCsvMedicion } from '../api'
import type { ResultadoDuplicadoDetectado } from '../types'

// Punto de entrada de una ficha nueva (motivo 'Medición'): subir el .csv de
// Nextsense/cpo (autocompleta todo el header) o registrar manualmente
// (requiere Tren + Kilometraje para poder crear el esqueleto de 48 filas
// vacías — ver CrearManualDto en el backend). Mismo lenguaje visual que
// MigracionUpload (dropzone), en un panel más chico porque vive embebido en
// la propia pantalla de Nuevas Mediciones, no en una ruta aparte.
type Props = {
  // autoVerificar=true SOLO en el flujo de carga por CSV exitosa (nunca en
  // modo manual, que arranca con la tabla vacía y no tiene nada que
  // verificar todavía) — NuevasMediciones.tsx lo usa para disparar
  // automáticamente la misma verificación que dispararía un click manual en
  // "Verificar", sin esperar a que el usuario la pida.
  onCreada: (fichaId: string, autoVerificar?: boolean) => void
}

export function CargaInicialFicha({ onCreada }: Props) {
  const [modo, setModo] = useState<'csv' | 'manual'>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [trenNumero, setTrenNumero] = useState('')
  const [kilometraje, setKilometraje] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  // POST .../upload puede responder duplicadoDetectado en vez de crear la
  // ficha — se guarda acá para mostrar el aviso. Es definitivo: no existe
  // ningún camino para forzar esta carga puntual, solo cerrar el aviso y
  // subir un archivo distinto (ver reintentarConOtroArchivo).
  const [duplicado, setDuplicado] = useState<ResultadoDuplicadoDetectado | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  async function subir(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    setError(null)
    setCargando(true)
    try {
      const resumen = await subirCsvMedicion(file)
      if ('duplicadoDetectado' in resumen) {
        setDuplicado(resumen)
        return
      }
      onCreada(resumen.fichaId, true)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo procesar el archivo.'))
    } finally {
      setCargando(false)
    }
  }

  // Único camino hacia adelante tras un duplicado exacto (punto 4 de la
  // ampliación): cierra el aviso, limpia el archivo elegido y reabre el
  // selector de inmediato — nunca un botón de "continuar de todas formas".
  function reintentarConOtroArchivo() {
    setDuplicado(null)
    setFile(null)
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    inputArchivoRef.current?.click()
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
              ref={inputArchivoRef}
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

      {duplicado && (
        <GlassModal
          titulo="Posible carga duplicada"
          onCerrar={reintentarConOtroArchivo}
          footer={
            <div className="mt-5 flex justify-end">
              <GlassButton type="button" onClick={reintentarConOtroArchivo} className="px-5 py-2.5 text-xs">
                Subir otro CSV
              </GlassButton>
            </div>
          }
        >
          <p className="font-body text-sm text-concreto-oscuro">
            Este archivo tiene la misma fecha, kilometraje y medidas que la última ficha confirmada del Tren{' '}
            {duplicado.tren} ({duplicado.fecha}). No se puede volver a cargar — subí un archivo distinto para
            continuar.
          </p>
        </GlassModal>
      )}
    </div>
  )
}
