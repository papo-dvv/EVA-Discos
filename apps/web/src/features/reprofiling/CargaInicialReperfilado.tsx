import { useState, type FormEvent } from 'react'
import { LoaderCircle, ScanLine } from 'lucide-react'
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
import { BotonFechaHoy } from '../new-measurement/components/BotonFechaHoy'
import { aFechaCorta, fechaHoraHoyLocal } from '../new-measurement/fecha'
import { useInvalidarHistorialMediciones, useReferenciaFicha } from '../new-measurement/queries'

type TipoTren = 'ALSTOM' | 'ANSALDO'

// ANSALDO (trenes 1-5) todavía no tiene catálogo de coches/bogies sembrado
// (ver apps/api/prisma/seed.ts) — el backend rechaza cualquier tren fuera de
// 6-44 (ver validarTrenAlstom). Se deja el tipo declarado para cuando se
// habilite, pero por ahora el selector solo ofrece ALSTOM.
const OPCIONES_TIPO_TREN = [{ valor: 'ALSTOM', etiqueta: 'ALSTOM' }]

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

type Props = {
  onCreada: (id: string) => void
  // Preselección desde ModalPendientesReperfilado (Operaciones): el usuario
  // ya eligió el tren en la tarjeta de "reperfilado pendiente", no tiene
  // sentido pedírselo de nuevo — mismo criterio que trenInicial en
  // CargaInicialFicha.tsx (Medición). Todo tren pendiente hoy es Alstom (el
  // selector "Tipo de tren" solo ofrece esa opción), así que el tipo no
  // necesita precargarse aparte.
  trenInicial?: number
}

export function CargaInicialReperfilado({ onCreada, trenInicial }: Props) {
  const [tipoTren, setTipoTren] = useState<TipoTren>('ALSTOM')
  const [trenNumero, setTrenNumero] = useState(
    trenInicial !== undefined ? String(trenInicial) : '',
  )
  const [kilometraje, setKilometraje] = useState('')
  const [modo, setModo] = useState<'foto' | 'manual'>('foto')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ocr, setOcr] = useState<ResultadoOcrReperfilado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [leyendoFoto, setLeyendoFoto] = useState(false)
  const [progresoFoto, setProgresoFoto] = useState(0)
  // El modo manual arranca con el mismo header completo que HeaderReperfilado
  // muestra DESPUÉS de crear la ficha (Tren/Kilometraje/P.T./fecha-hora
  // inicio/fin), no solo Tren y Kilometraje — P.T. y las horas se guardan con
  // un PATCH aparte apenas se conoce el fichaId (crearFichaManual no los
  // acepta, ver CrearManualDto); la Fecha de la ficha se deriva de la fecha
  // de inicio.
  const [puestoTrabajo, setPuestoTrabajo] = useState('')
  const [fechaHoraInicio, setFechaHoraInicio] = useState('')
  const [fechaHoraFin, setFechaHoraFin] = useState('')
  const invalidarHistorial = useInvalidarHistorialMediciones()

  const trenNumeroInt = Number(trenNumero)
  const trenValido = trenNumero.trim() !== '' && Number.isInteger(trenNumeroInt)
  const referencia = useReferenciaFicha(trenValido ? trenNumeroInt : undefined, 'ultima_medicion')
  const referenciaDisponible =
    referencia.data?.disponible && 'fecha' in referencia.data ? referencia.data : undefined

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
        fecha: fechaHoraInicio ? fechaHoraInicio.slice(0, 10) : undefined,
        motivo: 'Reperfilado',
      })
      // crearFichaManual no acepta P.T./horas (no forman parte de
      // CrearManualDto, ver backend) — se guardan con un PATCH aparte apenas
      // se conoce el fichaId, mismo criterio que crearDesdeFoto más abajo.
      if (puestoTrabajo.trim() || fechaHoraInicio || fechaHoraFin) {
        await editarFicha(ficha.fichaId, {
          puestoTrabajo: puestoTrabajo.trim() || undefined,
          fechaHoraInicio: fechaHoraInicio ? new Date(fechaHoraInicio).toISOString() : undefined,
          fechaHoraFin: fechaHoraFin ? new Date(fechaHoraFin).toISOString() : undefined,
        })
      }
      invalidarHistorial()
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
    setLeyendoFoto(true)
    setProgresoFoto(2)
    try {
      const resultado = await leerFotoReperfilado(archivo, setProgresoFoto)
      setProgresoFoto(100)
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
      setLeyendoFoto(false)
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
        codigosBogie:
          Object.keys(ocr.codigosBogie).length > 0
            ? ocr.codigosBogie
            : undefined,
        comentariosActividad: ocr.comentariosActividad ?? undefined,
        tecnicos: ocr.tecnicos.map((tecnico) => ({
          posicion: tecnico.posicion,
          nombre: tecnico.nombre ?? undefined,
          fecha: tecnico.fecha ?? undefined,
          firma: tecnico.firma ?? undefined,
        })),
        instrumentos: ocr.instrumentos.map((instrumento) => ({
          posicion: instrumento.posicion,
          codigo: instrumento.codigo ?? undefined,
          descripcion: instrumento.descripcion ?? undefined,
          modeloMarca: instrumento.modeloMarca ?? undefined,
          fechaCalibracion: instrumento.fechaCalibracion ?? undefined,
          fechaVencimientoCalibracion: instrumento.fechaVencimientoCalibracion ?? undefined,
          observaciones: instrumento.observaciones ?? undefined,
        })),
        ingMrNombre: ocr.ingMr?.nombre ?? undefined,
        ingMrFecha: ocr.ingMr?.fecha ?? undefined,
        ingMrFirma: ocr.ingMr?.firma ?? undefined,
        responsableMantenimientoNombre:
          ocr.responsableMantenimiento?.nombre ?? undefined,
        responsableMantenimientoFecha:
          ocr.responsableMantenimiento?.fecha ?? undefined,
        responsableMantenimientoFirma:
          ocr.responsableMantenimiento?.firma ?? undefined,
      })
      for (const fila of ocr.filas) {
        const { confianza: _confianza, tAntes, hAntes, ...medicion } = fila
        await agregarFilaFicha(ficha.fichaId, {
          ...medicion,
          reperfiladoTAntes: tAntes,
          reperfiladoHAntes: hAntes,
        })
      }
      invalidarHistorial()
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
    <div className="relative" aria-busy={leyendoFoto || undefined}>
      <div>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <p className="mt-1.5 text-[0.6875rem] font-medium leading-snug text-concreto">
                  Última registrada: {aFechaCorta(referenciaDisponible.fecha)} · {referenciaDisponible.kilometraje} km
                </p>
              )}
            </div>
            <GlassField
              label="P.T."
              placeholder="Puesto de trabajo"
              value={puestoTrabajo}
              onChange={(e) => setPuestoTrabajo(e.target.value)}
            />
            <div>
              <label
                htmlFor="reperfilado-manual-inicio"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
              >
                Fecha / hora inicio
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="reperfilado-manual-inicio"
                  type="datetime-local"
                  value={fechaHoraInicio}
                  onChange={(e) => setFechaHoraInicio(e.target.value)}
                  className="glass-field w-full min-w-0 px-3 py-2 text-sm"
                />
                <BotonFechaHoy onClick={() => setFechaHoraInicio(fechaHoraHoyLocal())} />
              </div>
            </div>
            <div>
              <label
                htmlFor="reperfilado-manual-fin"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
              >
                Fecha / hora fin
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="reperfilado-manual-fin"
                  type="datetime-local"
                  value={fechaHoraFin}
                  onChange={(e) => setFechaHoraFin(e.target.value)}
                  className="glass-field w-full min-w-0 px-3 py-2 text-sm"
                />
                <BotonFechaHoy onClick={() => setFechaHoraFin(fechaHoraHoyLocal())} />
              </div>
            </div>
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

      {leyendoFoto && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-glass-lg bg-white/50 p-6 text-center backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-xs">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/75 text-verde-oscuro shadow-sm">
              {progresoFoto < 90 ? (
                <LoaderCircle size={25} className="animate-spin" aria-hidden />
              ) : (
                <ScanLine size={25} className="animate-pulse" aria-hidden />
              )}
            </div>
            <p className="mt-4 font-body text-sm font-semibold text-concreto-oscuro">
              {progresoFoto < 90 ? 'Subiendo fotografía' : 'Escaneando la ficha'}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold text-verde-oscuro">
              {progresoFoto}%
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/75"
              aria-label={`Progreso de escaneo: ${progresoFoto}%`}
            >
              <div
                className="h-full rounded-full bg-verde-institucional transition-[width] duration-300"
                style={{ width: `${progresoFoto}%` }}
              />
            </div>
            <p className="mt-3 font-body text-xs text-concreto">
              {progresoFoto < 90
                ? 'Cargando la fotografía para su lectura.'
                : 'Reconociendo los datos manuscritos de la ficha.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
