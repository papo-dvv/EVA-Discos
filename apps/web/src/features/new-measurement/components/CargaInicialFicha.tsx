import { useRef, useState, type FormEvent } from 'react'
import { ClipboardPenLine, Upload } from 'lucide-react'
import { GlassButton } from '../../../components/GlassButton'
import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { GlassField } from '../../../components/GlassField'
import { GlassModal } from '../../../components/GlassModal'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { extraerMensajeError } from '../../../lib/extraerMensajeError'
import { fabricanteDeTren } from '../../fleet/components/fabricante'
import { crearFichaManual, editarFicha, subirCsvMedicion } from '../api'
import { aFechaCorta, fechaHoyCorta } from '../fecha'
import { useInvalidarHistorialMediciones, useReferenciaFicha } from '../queries'
import type { ResultadoDuplicadoDetectado } from '../types'
import { BotonFechaHoy } from './BotonFechaHoy'

// Fichas de medición aún no habilitadas para la flota Ansaldo (sin catálogo
// de discos sembrado — ver fabricanteDeTren) — mientras eso no exista, tanto
// CSV como registro manual quedan deshabilitados para esos trenes.
const TOOLTIP_ANSALDO_DESHABILITADO = 'Fichas de medición aún no habilitadas para trenes Ansaldo.'

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
  deshabilitada?: boolean
  // Preselección desde el botón que abrió este formulario (card de tren en
  // Mediciones → ModalCargaInicialMedicion): "csv"/"manual" arrancan el
  // SegmentedControl en el modo elegido en vez de siempre "csv", y
  // trenInicial precarga el campo Tren del modo manual (el usuario ya lo
  // eligió en la card, no tiene sentido pedírselo de nuevo). Ambos opcionales
  // — sin ellos, el comportamiento es idéntico al de antes (embebido en
  // NuevasMediciones, sin preselección).
  modoInicial?: 'csv' | 'manual'
  trenInicial?: number
}

export function CargaInicialFicha({
  onCreada,
  deshabilitada = false,
  modoInicial = 'csv',
  trenInicial,
}: Props) {
  const [modo, setModo] = useState<'csv' | 'manual'>(modoInicial)
  const [file, setFile] = useState<File | null>(null)
  const [trenNumero, setTrenNumero] = useState(
    trenInicial !== undefined ? String(trenInicial) : '',
  )
  const [kilometraje, setKilometraje] = useState('')
  const [fecha, setFecha] = useState(fechaHoyCorta())
  const [ptCodigo, setPtCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const trenNumeroInt = Number(trenNumero)
  const trenValido = trenNumero.trim() !== '' && Number.isInteger(trenNumeroInt)
  const esAnsaldo = trenValido && fabricanteDeTren(trenNumeroInt) === 'ANSALDO'

  // Misma query/caché que HeaderFicha ya usa para el banner "Última
  // registrada" del header de una ficha en curso (ver NuevasMediciones.tsx) —
  // acá se reutiliza para mostrarlo también ANTES de crear la ficha, apenas
  // se conoce el Tren.
  const referencia = useReferenciaFicha(trenValido ? trenNumeroInt : undefined, 'ultima_medicion')
  const referenciaDisponible =
    referencia.data?.disponible && 'fecha' in referencia.data ? referencia.data : undefined
  // POST .../upload puede responder duplicadoDetectado en vez de crear la
  // ficha — se guarda acá para mostrar el aviso. Es definitivo: no existe
  // ningún camino para forzar esta carga puntual, solo cerrar el aviso y
  // subir un archivo distinto (ver reintentarConOtroArchivo).
  const [duplicado, setDuplicado] = useState<ResultadoDuplicadoDetectado | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const invalidarHistorial = useInvalidarHistorialMediciones()

  async function subir(event: FormEvent) {
    event.preventDefault()
    if (deshabilitada) return
    if (!file) return
    setError(null)
    setCargando(true)
    try {
      const resumen = await subirCsvMedicion(file)
      invalidarHistorial()
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
    if (deshabilitada || esAnsaldo) return
    setError(null)
    setCargando(true)
    try {
      const resumen = await crearFichaManual({
        trenNumero: Number(trenNumero),
        kilometraje: Number(kilometraje),
        fecha: fecha || undefined,
      })
      // crearFichaManual no acepta P.T. (no forma parte de CrearManualDto,
      // ver backend) — se guarda con un PATCH aparte apenas se conoce el
      // fichaId, para no obligar al usuario a volver a escribirlo en el
      // header de la ficha recién creada.
      if (ptCodigo.trim()) {
        await editarFicha(resumen.fichaId, { ptCodigo: ptCodigo.trim() })
      }
      invalidarHistorial()
      onCreada(resumen.fichaId)
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo crear la ficha.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={deshabilitada ? 'pointer-events-none opacity-45' : undefined} aria-disabled={deshabilitada || undefined}>
      <SegmentedControl
        ariaLabel="Origen de la ficha"
        opciones={[
          {
            valor: 'csv',
            etiqueta: 'Subir archivo .csv',
            icono: <Upload size={15} aria-hidden />,
            deshabilitada: esAnsaldo,
            tooltip: esAnsaldo ? TOOLTIP_ANSALDO_DESHABILITADO : undefined,
          },
          {
            valor: 'manual',
            etiqueta: 'Registrar manualmente',
            icono: <ClipboardPenLine size={15} aria-hidden />,
            deshabilitada: esAnsaldo,
            tooltip: esAnsaldo ? TOOLTIP_ANSALDO_DESHABILITADO : undefined,
          },
        ]}
        valor={modo}
        onCambiar={setModo}
      />

      {modo === 'csv' ? (
        <form onSubmit={subir} className="mt-5">
          <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-7 text-center transition-colors hover:border-[color:var(--color-verde-institucional)]">
            <Upload size={28} className="text-verde-oscuro" aria-hidden />
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
              disabled={deshabilitada}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-end gap-1.5">
              <GlassDatePicker
                label="Fecha"
                value={fecha}
                onChange={(iso) => setFecha(iso)}
                className="flex-1"
              />
              <BotonFechaHoy onClick={() => setFecha(fechaHoyCorta())} />
            </div>
            <GlassField
              label="Tren"
              type="number"
              min={1}
              max={44}
              required
              value={trenNumero}
              onChange={(e) => setTrenNumero(e.target.value)}
            />
            <GlassField
              label="P.T."
              type="text"
              value={ptCodigo}
              onChange={(e) => setPtCodigo(e.target.value)}
            />
            <div>
              <GlassField
                label="Kilometraje"
                type="number"
                step="any"
                required
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
              />
              {referenciaDisponible && (
                <p className="mt-1.5 font-body text-[0.6875rem] font-medium leading-snug text-concreto">
                  Última registrada: {aFechaCorta(referenciaDisponible.fecha)} · {referenciaDisponible.kilometraje} km
                </p>
              )}
            </div>
          </div>
          {esAnsaldo && (
            <p className="mt-3 font-body text-xs text-[color:var(--color-estado-critico)]">
              {TOOLTIP_ANSALDO_DESHABILITADO}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-[color:var(--color-estado-critico)]">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <GlassButton type="submit" cargando={cargando} disabled={!trenNumero || !kilometraje || esAnsaldo}>
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
            Este archivo tiene la misma fecha, kilometraje y medidas que{' '}
            {duplicado.origen === 'reinicio'
              ? 'la ficha que se reinició recién para este mismo tren'
              : 'la última ficha confirmada'}{' '}
            del Tren {duplicado.tren} ({duplicado.fecha}). No se puede volver a cargar — subí un archivo distinto
            para continuar.
          </p>
        </GlassModal>
      )}
    </div>
  )
}
