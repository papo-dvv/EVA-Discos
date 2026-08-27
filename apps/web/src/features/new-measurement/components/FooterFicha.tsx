import { useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { aFechaCorta, fechaHoyCorta } from '../fecha'
import type {
  CambiosFicha,
  FichaInstrumento,
  FichaMedicion,
  FichaTecnico,
} from '../types'
import { BotonFechaHoy } from './BotonFechaHoy'
import { FirmaDigital } from './FirmaDigital'

type Props = {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
  limiteTecnicos?: number
  // 'reperfilado': reemplaza los bloques "Realizado por" + "Ing. MR /
  // Técnico Especialista" + "Responsable de Mantenimiento" por una única
  // tabla CARGO | NOMBRES Y APELLIDOS | FIRMA (cargo editable por fila) con
  // una 4ta fila fija "SUPERVISOR / COORDINADOR / TÉCNICO ESPECIALISTA" —
  // ver Reperfilado.tsx. Instrumentos y Comentarios no cambian.
  variante?: 'medicion' | 'reperfilado'
}

const CLASE_INPUT = 'glass-field w-full min-w-0 px-2.5 py-1.5 text-xs'
const MAX_CARACTERES_COMENTARIOS_ACTIVIDAD = 612

function firmaVacia(firma: string | null | undefined): boolean {
  return !firma?.startsWith('data:image/')
}

function bloquePersonaIncompleto(persona: {
  nombre: string
  firma: string
  fecha: string
}): boolean {
  const valores = [
    persona.nombre.trim(),
    firmaVacia(persona.firma) ? '' : persona.firma,
    persona.fecha,
  ]
  return valores.some(Boolean) && valores.some((valor) => !valor)
}

// Footer completo de la ficha (punto 3 del enunciado): instrumentos (3 filas
// fijas), comentarios, técnicos (4 fijos, 2x2) y el bloque Ing. MR/Responsable
// de Mantenimiento — este último es el ÚNICO campo obligatorio de toda la
// ficha para poder confirmarla (ver NewMeasurementCommitService.confirmar).
// Ya no se renderiza deshabilitado-pero-visible: NuevasMediciones.tsx directamente
// no monta este componente hasta que tabla_bloqueada=true, así que acá adentro
// todo está siempre habilitado — no hace falta ningún estado "bloqueada".
export function FooterFicha({ ficha, onGuardar, limiteTecnicos, variante = 'medicion' }: Props) {
  return (
    <div className="mt-6 space-y-5">
      <GlassSurface fuerte className="rounded-glass p-5">
        <h2 className="mb-2 font-display text-sm font-semibold text-concreto-oscuro">
          Lista de instrumentos
        </h2>
        <TablaInstrumentos
          instrumentos={ficha.instrumentos}
          fechaVerificacion={ficha.fechaFicha}
          onGuardar={onGuardar}
        />
      </GlassSurface>

      <GlassSurface fuerte className="rounded-glass p-5">
        <h2 className="mb-2 font-display text-sm font-semibold text-concreto-oscuro">
          Comentarios respecto de la actividad
        </h2>
        <ComentariosActividad
          valor={ficha.comentariosActividad ?? ''}
          onGuardar={onGuardar}
        />
      </GlassSurface>

      {variante === 'reperfilado' ? (
        <TablaFirmasReperfilado
          tecnicos={ficha.tecnicos.slice(0, limiteTecnicos)}
          responsableNombre={ficha.responsableMantenimientoNombre ?? ''}
          responsableFirma={ficha.responsableMantenimientoFirma ?? ''}
          onGuardar={onGuardar}
        />
      ) : (
        <>
          <GlassSurface fuerte className="rounded-glass p-5">
            <h2 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">
              Realizado por
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ficha.tecnicos.slice(0, limiteTecnicos).map((t) => (
                <FilaTecnico key={t.posicion} tecnico={t} onGuardar={onGuardar} />
              ))}
            </div>
          </GlassSurface>

          <GlassSurface fuerte className="rounded-glass p-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <BloqueResponsable
                titulo="Ing. MR / Técnico Especialista"
                nombre={ficha.ingMrNombre ?? ''}
                firma={ficha.ingMrFirma ?? ''}
                fecha={aFechaCorta(ficha.ingMrFecha)}
                onGuardar={(cambios) =>
                  onGuardar({
                    ingMrNombre: cambios.nombre,
                    ingMrFirma: cambios.firma,
                    ingMrFecha: cambios.fecha,
                  })
                }
              />
              <BloqueResponsable
                titulo="Responsable de Mantenimiento"
                nombre={ficha.responsableMantenimientoNombre ?? ''}
                firma={ficha.responsableMantenimientoFirma ?? ''}
                fecha={aFechaCorta(ficha.responsableMantenimientoFecha)}
                nombreObligatorio
                onGuardar={(cambios) =>
                  onGuardar({
                    responsableMantenimientoNombre: cambios.nombre,
                    responsableMantenimientoFirma: cambios.firma,
                    responsableMantenimientoFecha: cambios.fecha,
                  })
                }
              />
            </div>
          </GlassSurface>
        </>
      )}
    </div>
  )
}

// Tabla CARGO | NOMBRES Y APELLIDOS | FIRMA de Reperfilado: 3 filas de
// técnico (cargo editable, ej. "Ing. MR", "Técnico Especialista") + una 4ta
// fila fija "SUPERVISOR / COORDINADOR / TÉCNICO ESPECIALISTA" que reutiliza
// los campos responsableMantenimiento* (único dato obligatorio para poder
// confirmar la ficha — ver NewMeasurementCommitService.confirmar).
function TablaFirmasReperfilado({
  tecnicos,
  responsableNombre,
  responsableFirma,
  onGuardar,
}: {
  tecnicos: FichaTecnico[]
  responsableNombre: string
  responsableFirma: string
  onGuardar: (cambios: CambiosFicha) => void
}) {
  return (
    <GlassSurface fuerte className="rounded-glass p-4">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left font-body text-[0.6875rem]">
          <thead>
            <tr className="border-b border-concreto/20 text-[0.625rem] font-semibold uppercase tracking-wide text-concreto">
              <th className="w-1/4 px-1.5 py-1.5">Cargo</th>
              <th className="w-2/5 px-1.5 py-1.5">Nombres y apellidos</th>
              <th className="px-1.5 py-1.5">Firma</th>
            </tr>
          </thead>
          <tbody>
            {tecnicos.map((t) => (
              <FilaFirmaTecnico key={t.posicion} tecnico={t} onGuardar={onGuardar} />
            ))}
            <FilaFirmaFija
              cargo="SUPERVISOR / COORDINADOR / TÉCNICO ESPECIALISTA:"
              nombre={responsableNombre}
              firma={responsableFirma}
              nombreObligatorio
              onGuardar={(cambios) =>
                onGuardar({
                  responsableMantenimientoNombre: cambios.nombre,
                  responsableMantenimientoFirma: cambios.firma,
                })
              }
            />
          </tbody>
        </table>
      </div>
    </GlassSurface>
  )
}

function FilaFirmaTecnico({
  tecnico,
  onGuardar,
}: {
  tecnico: FichaTecnico
  onGuardar: (cambios: CambiosFicha) => void
}) {
  const [cargo, setCargo] = useSyncedState(tecnico.cargo ?? '')
  const [nombre, setNombre] = useSyncedState(tecnico.nombre ?? '')

  function guardarCampo(campo: 'cargo' | 'nombre' | 'firma', valor: string) {
    onGuardar({ tecnicos: [{ posicion: tecnico.posicion, [campo]: valor }] })
  }

  return (
    <tr className="border-b border-concreto/10 align-top">
      <td className="px-1.5 py-1">
        <input
          className={CLASE_INPUT}
          placeholder="Cargo"
          aria-label={`Cargo fila ${tecnico.posicion}`}
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          onBlur={(e) => guardarCampo('cargo', e.target.value)}
        />
      </td>
      <td className="px-1.5 py-1">
        <input
          className={CLASE_INPUT}
          placeholder="Nombre"
          aria-label={`Nombre fila ${tecnico.posicion}`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={(e) => guardarCampo('nombre', e.target.value)}
        />
      </td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-2">
          <FirmaDigital
            etiqueta={`Fila ${tecnico.posicion}`}
            valor={tecnico.firma ?? ''}
            onGuardar={(firma) => guardarCampo('firma', firma)}
          />
        </div>
      </td>
    </tr>
  )
}

function FilaFirmaFija({
  cargo,
  nombre,
  firma,
  nombreObligatorio = false,
  onGuardar,
}: {
  cargo: string
  nombre: string
  firma: string
  nombreObligatorio?: boolean
  onGuardar: (cambios: { nombre?: string; firma?: string }) => void
}) {
  const [borradorNombre, setBorradorNombre] = useSyncedState(nombre)
  const vacio = nombreObligatorio && borradorNombre.trim() === ''

  return (
    <tr className="border-t-2 border-concreto/25 align-top">
      <td className="px-1.5 py-1 text-[0.6875rem] font-semibold text-concreto-oscuro">
        <span className="inline-flex items-center gap-1.5">
          {cargo}
          {nombreObligatorio && (
            <WarningTooltip texto="Debe tener nombre y firma para poder confirmar la ficha.">
              <span className="text-[color:var(--color-estado-critico)]">*</span>
            </WarningTooltip>
          )}
        </span>
      </td>
      <td className="px-1.5 py-1">
        <input
          className={`${CLASE_INPUT} ${vacio ? 'ring-1 ring-[color:var(--color-estado-critico)]/50' : ''}`.trim()}
          placeholder="Nombre"
          aria-label={`Nombre ${cargo}`}
          aria-required={nombreObligatorio}
          value={borradorNombre}
          onChange={(e) => setBorradorNombre(e.target.value)}
          onBlur={(e) => onGuardar({ nombre: e.target.value })}
        />
      </td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-2">
          <FirmaDigital
            etiqueta={cargo}
            valor={firma}
            onGuardar={(valor) => onGuardar({ firma: valor })}
          />
        </div>
      </td>
    </tr>
  )
}

function TablaInstrumentos({
  instrumentos,
  fechaVerificacion,
  onGuardar,
}: {
  instrumentos: FichaInstrumento[]
  fechaVerificacion: string
  onGuardar: (cambios: CambiosFicha) => void
}) {
  return (
    <div className="w-full">
      <table className="w-full table-fixed border-collapse text-left font-body text-xs">
        <thead>
          <tr className="border-b border-concreto/20 text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
            <th className="px-2 py-2">Código</th>
            <th className="px-2 py-2">Descripción</th>
            <th className="px-2 py-2">Modelo/Marca</th>
            <th className="px-2 py-2">Fecha de calibración</th>
            <th className="px-2 py-2">Fecha de vencimiento</th>
            <th className="px-2 py-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {instrumentos.map((inst) => (
            <FilaInstrumento
              key={inst.posicion}
              instrumento={inst}
              fechaVerificacion={fechaVerificacion}
              onGuardar={onGuardar}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilaInstrumento({
  instrumento,
  fechaVerificacion,
  onGuardar,
}: {
  instrumento: FichaInstrumento
  fechaVerificacion: string
  onGuardar: (cambios: CambiosFicha) => void
}) {
  const [form, setForm] = useState({
    codigo: instrumento.codigo ?? '',
    descripcion: instrumento.descripcion ?? '',
    modeloMarca: instrumento.modeloMarca ?? '',
    fechaCalibracion: aFechaCorta(instrumento.fechaCalibracion),
    fechaVencimientoCalibracion: aFechaCorta(
      instrumento.fechaVencimientoCalibracion,
    ),
    observaciones: instrumento.observaciones ?? '',
  })

  function guardarCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
    onGuardar({
      instrumentos: [{ posicion: instrumento.posicion, [campo]: valor }],
    })
  }

  const valores = Object.values(form).map((valor) => valor.trim())
  const filaIncompleta =
    valores.some(Boolean) && valores.some((valor) => !valor)
  const vencimientoInvalido =
    Boolean(form.fechaVencimientoCalibracion) &&
    (form.fechaVencimientoCalibracion < fechaVerificacion.slice(0, 10) ||
      (Boolean(form.fechaCalibracion) &&
        form.fechaVencimientoCalibracion < form.fechaCalibracion))
  const fechaMinimaVencimiento =
    [fechaVerificacion.slice(0, 10), form.fechaCalibracion]
      .filter(Boolean)
      .sort()
      .at(-1) ?? ''

  return (
    <>
      <tr className="border-b border-concreto/10">
        <td className="px-2 py-1.5">
          <input
            className={CLASE_INPUT}
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            onBlur={(e) => guardarCampo('codigo', e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            className={CLASE_INPUT}
            value={form.descripcion}
            onChange={(e) =>
              setForm((f) => ({ ...f, descripcion: e.target.value }))
            }
            onBlur={(e) => guardarCampo('descripcion', e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            className={CLASE_INPUT}
            value={form.modeloMarca}
            onChange={(e) =>
              setForm((f) => ({ ...f, modeloMarca: e.target.value }))
            }
            onBlur={(e) => guardarCampo('modeloMarca', e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="date"
            className={CLASE_INPUT}
            value={form.fechaCalibracion}
            onChange={(e) =>
              setForm((f) => ({ ...f, fechaCalibracion: e.target.value }))
            }
            onBlur={(e) => guardarCampo('fechaCalibracion', e.target.value)}
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            type="date"
            min={fechaMinimaVencimiento}
            className={CLASE_INPUT}
            value={form.fechaVencimientoCalibracion}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                fechaVencimientoCalibracion: e.target.value,
              }))
            }
            onBlur={(e) =>
              guardarCampo('fechaVencimientoCalibracion', e.target.value)
            }
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            className={CLASE_INPUT}
            value={form.observaciones}
            onChange={(e) =>
              setForm((f) => ({ ...f, observaciones: e.target.value }))
            }
            onBlur={(e) => guardarCampo('observaciones', e.target.value)}
          />
        </td>
      </tr>
      {(filaIncompleta || vencimientoInvalido) && (
        <tr className="border-b border-concreto/10">
          <td
            colSpan={6}
            className="px-2 pb-2 text-xs text-[color:var(--color-estado-critico)]"
          >
            {filaIncompleta
              ? 'Completa todos los campos de esta fila o déjala vacía.'
              : 'La fecha de vencimiento no puede ser anterior a la fecha de verificación ni a la de calibración.'}
          </td>
        </tr>
      )}
    </>
  )
}

function ComentariosActividad({
  valor,
  onGuardar,
}: {
  valor: string
  onGuardar: (cambios: CambiosFicha) => void
}) {
  const [borrador, setBorrador] = useSyncedState(valor)

  return (
    <div className="space-y-1.5">
      <textarea
        rows={3}
        maxLength={MAX_CARACTERES_COMENTARIOS_ACTIVIDAD}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => {
          if (borrador !== valor) onGuardar({ comentariosActividad: borrador })
        }}
        className="glass-field resize-y px-3 py-2 text-xs"
        placeholder="Observaciones generales de la actividad…"
      />
      <p className="text-right font-body text-[0.6875rem] text-concreto">
        {borrador.length}/{MAX_CARACTERES_COMENTARIOS_ACTIVIDAD}
      </p>
    </div>
  )
}

function FilaTecnico({
  tecnico,
  onGuardar,
}: {
  tecnico: FichaTecnico
  onGuardar: (cambios: CambiosFicha) => void
}) {
  const [form, setForm] = useState({
    nombre: tecnico.nombre ?? '',
    firma: tecnico.firma ?? '',
    fecha: aFechaCorta(tecnico.fecha),
  })

  function guardarCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
    onGuardar({ tecnicos: [{ posicion: tecnico.posicion, [campo]: valor }] })
  }

  const incompleto = bloquePersonaIncompleto(form)

  return (
    <div className="rounded-2xl border border-[color:var(--glass-border)] bg-white/40 p-3.5">
      <p className="mb-2 font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-concreto">
        Técnico {tecnico.posicion}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          className={CLASE_INPUT}
          placeholder="Nombre"
          aria-label={`Nombre técnico ${tecnico.posicion}`}
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          onBlur={(e) => guardarCampo('nombre', e.target.value)}
        />
        <FirmaDigital
          etiqueta={`Técnico ${tecnico.posicion}`}
          valor={form.firma}
          onGuardar={(firma) => guardarCampo('firma', firma)}
        />
        <div className="flex items-center gap-1">
          <input
            type="date"
            className={`${CLASE_INPUT} flex-1`}
            aria-label={`Fecha técnico ${tecnico.posicion}`}
            value={form.fecha}
            onChange={(e) => guardarCampo('fecha', e.target.value)}
          />
          <BotonFechaHoy
            onClick={() => guardarCampo('fecha', fechaHoyCorta())}
          />
        </div>
      </div>
      {incompleto && (
        <p className="mt-2 font-body text-xs text-[color:var(--color-estado-critico)]">
          Completa nombre, firma y fecha, o deja los 3 campos vacíos.
        </p>
      )}
    </div>
  )
}

function BloqueResponsable({
  titulo,
  nombre,
  firma,
  fecha,
  nombreObligatorio = false,
  onGuardar,
}: {
  titulo: string
  nombre: string
  firma: string
  fecha: string
  nombreObligatorio?: boolean
  onGuardar: (cambios: {
    nombre?: string
    firma?: string
    fecha?: string
  }) => void
}) {
  const [borradorNombre, setBorradorNombre] = useSyncedState(nombre)
  const [borradorFirma, setBorradorFirma] = useSyncedState(firma)
  const [borradorFecha, setBorradorFecha] = useSyncedState(fecha)

  const incompleto = bloquePersonaIncompleto({
    nombre: borradorNombre,
    firma: borradorFirma,
    fecha: borradorFecha,
  })
  const vacio = nombreObligatorio && borradorNombre.trim() === ''

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 font-body text-sm font-semibold text-concreto-oscuro">
        {titulo}
        {nombreObligatorio && (
          <WarningTooltip texto="Responsable de Mantenimiento debe tener nombre, firma y fecha para poder confirmar la ficha.">
            <span className="text-[color:var(--color-estado-critico)]">*</span>
          </WarningTooltip>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          className={`${CLASE_INPUT} ${vacio ? 'ring-1 ring-[color:var(--color-estado-critico)]/50' : ''}`.trim()}
          placeholder="Nombre"
          aria-label={`Nombre ${titulo}`}
          aria-required={nombreObligatorio}
          value={borradorNombre}
          onChange={(e) => setBorradorNombre(e.target.value)}
          onBlur={(e) => onGuardar({ nombre: e.target.value })}
        />
        <FirmaDigital
          etiqueta={titulo}
          valor={borradorFirma}
          onGuardar={(firma) => {
            setBorradorFirma(firma)
            onGuardar({ firma })
          }}
        />
        <div className="flex items-center gap-1">
          <input
            type="date"
            className={`${CLASE_INPUT} flex-1`}
            aria-label={`Fecha ${titulo}`}
            value={borradorFecha}
            onChange={(e) => {
              setBorradorFecha(e.target.value)
              onGuardar({ fecha: e.target.value })
            }}
          />
          <BotonFechaHoy
            onClick={() => {
              setBorradorFecha(fechaHoyCorta())
              onGuardar({ fecha: fechaHoyCorta() })
            }}
          />
        </div>
      </div>
      {incompleto && (
        <p className="mt-2 font-body text-xs text-[color:var(--color-estado-critico)]">
          Completa nombre, firma y fecha, o deja los 3 campos vacíos.
        </p>
      )}
    </div>
  )
}
