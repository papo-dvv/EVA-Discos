import { useState, type FormEvent } from 'react'
import { GlassButton } from '../../components/GlassButton'
import { GlassField } from '../../components/GlassField'
import { GlassSelect } from '../../components/GlassSelect'
import { SegmentedControl } from '../../components/SegmentedControl'
import {
  agregarFilaFicha,
  crearFichaManual,
  editarFicha,
  leerFotoReperfilado,
  type ResultadoOcrReperfilado,
} from '../new-measurement/api'
import { extraerMensajeError } from '../../lib/extraerMensajeError'

type TipoTren = 'ALSTOM' | 'ANSALDO'

const OPCIONES_TIPO_TREN = [
  { valor: 'ALSTOM', etiqueta: 'ALSTOM' },
  { valor: 'ANSALDO', etiqueta: 'ANSALDO' },
]

function opcionesNumeroTren(tipo: TipoTren) {
  const inicio = tipo === 'ALSTOM' ? 6 : 1
  const cantidad = tipo === 'ALSTOM' ? 39 : 5
  return Array.from({ length: cantidad }, (_, indice) => {
    const numero = indice + inicio
    return {
      valor: String(numero),
      etiqueta: `T${String(numero).padStart(2, '0')}`,
    }
  })
}

const FORMATOS_FOTO = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

export function CargaInicialReperfilado({
  onCreada,
}: {
  onCreada: (id: string) => void
}) {
  const [tipoTren, setTipoTren] = useState<TipoTren>('ALSTOM')
  const [trenNumero, setTrenNumero] = useState('')
  const [kilometraje, setKilometraje] = useState('')
  const [modo, setModo] = useState<'foto' | 'manual'>('foto')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ocr, setOcr] = useState<ResultadoOcrReperfilado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  function seleccionarFoto(foto: File | null) {
    setArchivo(foto)
    setOcr(null)
    setError(null)
  }

  async function crear(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const ficha = await crearFichaManual({
        trenNumero: Number(trenNumero),
        kilometraje: Number(kilometraje),
        motivo: 'Reperfilado',
      })
      onCreada(ficha.fichaId)
    } catch (err) {
      setError(
        extraerMensajeError(err, 'No se pudo crear la ficha de reperfilado.'),
      )
    } finally {
      setCargando(false)
    }
  }

  async function leerFoto(event: FormEvent) {
    event.preventDefault()
    if (!archivo) return
    setError(null)
    setCargando(true)
    try {
      const resultado = await leerFotoReperfilado(archivo)
      setOcr(resultado)
      if (resultado.trenNumero !== null)
        setTipoTren(resultado.trenNumero <= 5 ? 'ANSALDO' : 'ALSTOM')
      setTrenNumero(
        resultado.trenNumero === null ? '' : String(resultado.trenNumero),
      )
      setKilometraje(
        resultado.kilometraje === null ? '' : String(resultado.kilometraje),
      )
    } catch (err) {
      setError(extraerMensajeError(err, 'No se pudo leer la fotografía.'))
    } finally {
      setCargando(false)
    }
  }

  async function crearDesdeFoto() {
    if (!ocr || !trenNumero || !kilometraje) return
    setCargando(true)
    setError(null)
    try {
      const ficha = await crearFichaManual({
        trenNumero: Number(trenNumero),
        kilometraje: Number(kilometraje),
        fecha: ocr.fecha ?? undefined,
        motivo: 'Reperfilado',
      })
      const fechaHoraInicio =
        ocr.fecha && ocr.horaInicio
          ? new Date(`${ocr.fecha}T${ocr.horaInicio}:00`).toISOString()
          : undefined
      const fechaHoraFin =
        ocr.fecha && ocr.horaFin
          ? new Date(`${ocr.fecha}T${ocr.horaFin}:00`).toISOString()
          : undefined
      await editarFicha(ficha.fichaId, {
        puestoTrabajo: ocr.puestoTrabajo ?? undefined,
        fechaHoraInicio,
        fechaHoraFin,
        codigosCoche:
          Object.keys(ocr.codigosCoche).length > 0
            ? ocr.codigosCoche
            : undefined,
      })
      for (const fila of ocr.filas) {
        const { confianza: _confianza, tAntes, hAntes, ...medicion } = fila
        await agregarFilaFicha(ficha.fichaId, {
          ...medicion,
          reperfiladoTAntes: tAntes,
          reperfiladoHAntes: hAntes,
        })
      }
      onCreada(ficha.fichaId)
    } catch (err) {
      setError(
        extraerMensajeError(
          err,
          'No se pudo crear la ficha desde la fotografía.',
        ),
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-concreto-oscuro">
        Nueva ficha de torno fosa
      </h2>
      <p className="mt-1 font-body text-sm text-concreto">
        Registra la ficha manualmente o toma una fotografía del formato físico
        para proponer los datos.
      </p>
      <div className="mt-5">
        <SegmentedControl<'foto' | 'manual'>
          ariaLabel="Origen del reperfilado"
          opciones={[
            { valor: 'foto', etiqueta: 'Leer fotografía' },
            { valor: 'manual', etiqueta: 'Registrar manualmente' },
          ]}
          valor={modo}
          onCambiar={setModo}
        />
      </div>
      {modo === 'foto' ? (
        <form onSubmit={leerFoto} className="mt-5">
          <div className="mb-4 rounded-2xl border border-white/70 bg-white/35 px-4 py-3 text-sm text-concreto">
            <p className="font-semibold text-concreto-oscuro">
              Para obtener una mejor lectura:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Incluye la ficha completa, desde el encabezado hasta las firmas,
                sin cortar bordes.
              </li>
              <li>
                Toma la foto de frente, con buena luz, sin sombras, reflejos ni
                desenfoque.
              </li>
              <li>
                El número de tren, kilometraje, P.T., fechas y valores deben
                verse nítidos.
              </li>
              <li>
                Usa tinta oscura y escribe los decimales claramente dentro de
                cada casilla.
              </li>
            </ul>
            <p className="mt-2 text-xs">
              La escritura manuscrita puede requerir correcciones; los campos no
              reconocidos quedarán disponibles para completarlos manualmente.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-7 text-center">
              <span
                aria-hidden="true"
                className="font-display text-2xl text-verde-oscuro"
              >
                ◎
              </span>
              <span className="text-sm font-semibold text-concreto-oscuro">
                Usar cámara
              </span>
              <span className="text-xs text-concreto">
                Fotografía la ficha física completa
              </span>
              <input
                type="file"
                accept={FORMATOS_FOTO}
                capture="environment"
                className="hidden"
                onChange={(e) => seleccionarFoto(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="glass-field flex cursor-pointer flex-col items-center gap-2 border-dashed py-7 text-center">
              <span
                aria-hidden="true"
                className="font-display text-2xl text-verde-oscuro"
              >
                ⇪
              </span>
              <span className="text-sm font-semibold text-concreto-oscuro">
                Subir fotografía
              </span>
              <span className="text-xs text-concreto">
                JPG, PNG, WEBP o HEIC
              </span>
              <input
                type="file"
                accept={FORMATOS_FOTO}
                className="hidden"
                onChange={(e) => seleccionarFoto(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {archivo && (
            <p className="mt-3 text-sm text-concreto">
              <span className="font-semibold text-concreto-oscuro">
                Fotografía seleccionada:
              </span>{' '}
              {archivo.name}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-3 text-sm text-[color:var(--color-estado-critico)]"
            >
              {error}
            </p>
          )}
          {!ocr ? (
            <div className="mt-5 flex justify-end">
              <GlassButton
                type="submit"
                cargando={cargando}
                disabled={!archivo}
              >
                Leer fotografía
              </GlassButton>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {ocr.advertencias.map((a) => (
                <p
                  key={a}
                  className="text-sm text-[color:var(--color-estado-seguimiento)]"
                >
                  ⚠ {a}
                </p>
              ))}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <GlassSelect
                  label="Tipo de tren *"
                  opciones={OPCIONES_TIPO_TREN}
                  seleccion={tipoTren}
                  onCambiar={(valor) => {
                    setTipoTren((valor ?? 'ALSTOM') as TipoTren)
                    setTrenNumero('')
                  }}
                  placeholder="Selecciona el tipo"
                />
                <GlassSelect
                  label="N.º de tren *"
                  opciones={opcionesNumeroTren(tipoTren)}
                  seleccion={trenNumero || undefined}
                  onCambiar={(valor) => setTrenNumero(valor ?? '')}
                  placeholder="Selecciona el número"
                />
                <GlassField
                  label="Kilometraje detectado"
                  required
                  type="number"
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                />
              </div>
              <p className="text-xs text-concreto">
                Confianza general: {ocr.confianza.toFixed(0)} %. Se detectaron{' '}
                {ocr.filas.length} posiciones; todas podrán corregirse en la
                ficha.
              </p>
              <div className="flex justify-end">
                <GlassButton
                  type="button"
                  cargando={cargando}
                  disabled={!trenNumero || !kilometraje}
                  onClick={crearDesdeFoto}
                >
                  Crear y revisar ficha
                </GlassButton>
              </div>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={crear} className="mt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GlassSelect
              label="Tipo de tren *"
              opciones={OPCIONES_TIPO_TREN}
              seleccion={tipoTren}
              onCambiar={(valor) => {
                setTipoTren((valor ?? 'ALSTOM') as TipoTren)
                setTrenNumero('')
              }}
              placeholder="Selecciona el tipo"
            />
            <GlassSelect
              label="N.º de tren *"
              opciones={opcionesNumeroTren(tipoTren)}
              seleccion={trenNumero || undefined}
              onCambiar={(valor) => setTrenNumero(valor ?? '')}
              placeholder="Selecciona el número"
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
            <p
              role="alert"
              className="mt-3 text-sm text-[color:var(--color-estado-critico)]"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <GlassButton
              type="submit"
              cargando={cargando}
              disabled={!trenNumero || !kilometraje}
            >
              Crear ficha de reperfilado
            </GlassButton>
          </div>
        </form>
      )}
    </div>
  )
}
