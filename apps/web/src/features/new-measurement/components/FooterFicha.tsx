import { useState } from 'react'
import { GlassSurface } from '../../../components/GlassSurface'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { aFechaCorta } from '../fecha'
import type { CambiosFicha, FichaInstrumento, FichaMedicion, FichaTecnico } from '../types'
import { FirmaDigital } from './FirmaDigital'

type Props = {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
}

const CLASE_INPUT =
  'glass-field px-2.5 py-1.5 text-xs'

// Footer completo de la ficha (punto 3 del enunciado): instrumentos (3 filas
// fijas), comentarios, técnicos (4 fijos, 2x2) y el bloque Ing. MR/Responsable
// de Mantenimiento — este último es el ÚNICO campo obligatorio de toda la
// ficha para poder confirmarla (ver NewMeasurementCommitService.confirmar).
// Ya no se renderiza deshabilitado-pero-visible: NuevasMediciones.tsx directamente
// no monta este componente hasta que tabla_bloqueada=true, así que acá adentro
// todo está siempre habilitado — no hace falta ningún estado "bloqueada".
export function FooterFicha({ ficha, onGuardar }: Props) {
  return (
    <div className="mt-6 space-y-5">
      <GlassSurface fuerte className="rounded-glass p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">Lista de instrumentos</h2>
        <TablaInstrumentos instrumentos={ficha.instrumentos} fechaVerificacion={ficha.fechaFicha} onGuardar={onGuardar} />
      </GlassSurface>

      <GlassSurface fuerte className="rounded-glass p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">
          Comentarios respecto de la actividad
        </h2>
        <ComentariosActividad valor={ficha.comentariosActividad ?? ''} onGuardar={onGuardar} />
      </GlassSurface>

      <GlassSurface fuerte className="rounded-glass p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-concreto-oscuro">Realizado por</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ficha.tecnicos.map((t) => (
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
    </div>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-left font-body text-xs">
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
            <FilaInstrumento key={inst.posicion} instrumento={inst} fechaVerificacion={fechaVerificacion} onGuardar={onGuardar} />
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
    fechaVencimientoCalibracion: aFechaCorta(instrumento.fechaVencimientoCalibracion),
    observaciones: instrumento.observaciones ?? '',
  })

  function guardarCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
    onGuardar({ instrumentos: [{ posicion: instrumento.posicion, [campo]: valor }] })
  }

  const valores = Object.values(form).map((valor) => valor.trim())
  const filaIncompleta = valores.some(Boolean) && valores.some((valor) => !valor)
  const vencimientoInvalido =
    Boolean(form.fechaVencimientoCalibracion) &&
    (form.fechaVencimientoCalibracion < fechaVerificacion.slice(0, 10) ||
      (Boolean(form.fechaCalibracion) &&
        form.fechaVencimientoCalibracion < form.fechaCalibracion))
  const fechaMinimaVencimiento =
    [fechaVerificacion.slice(0, 10), form.fechaCalibracion].filter(Boolean).sort().at(-1) ?? ''

  return (
    <>
      <tr className="border-b border-concreto/10">
      <td className="px-2 py-1.5">
        <input className={CLASE_INPUT} value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} onBlur={(e) => guardarCampo('codigo', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input className={CLASE_INPUT} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} onBlur={(e) => guardarCampo('descripcion', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input className={CLASE_INPUT} value={form.modeloMarca} onChange={(e) => setForm((f) => ({ ...f, modeloMarca: e.target.value }))} onBlur={(e) => guardarCampo('modeloMarca', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input type="date" className={CLASE_INPUT} value={form.fechaCalibracion} onChange={(e) => setForm((f) => ({ ...f, fechaCalibracion: e.target.value }))} onBlur={(e) => guardarCampo('fechaCalibracion', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input type="date" min={fechaMinimaVencimiento} className={CLASE_INPUT} value={form.fechaVencimientoCalibracion} onChange={(e) => setForm((f) => ({ ...f, fechaVencimientoCalibracion: e.target.value }))} onBlur={(e) => guardarCampo('fechaVencimientoCalibracion', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input className={CLASE_INPUT} value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} onBlur={(e) => guardarCampo('observaciones', e.target.value)} />
      </td>
      </tr>
      {(filaIncompleta || vencimientoInvalido) && (
        <tr className="border-b border-concreto/10">
          <td colSpan={6} className="px-2 pb-2 text-xs text-[color:var(--color-estado-critico)]">
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
    <textarea
      rows={3}
      value={borrador}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={() => {
        if (borrador !== valor) onGuardar({ comentariosActividad: borrador })
      }}
      className="glass-field resize-y px-3 py-2.5 text-sm"
      placeholder="Observaciones generales de la actividad…"
    />
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
        <input
          type="date"
          className={CLASE_INPUT}
          aria-label={`Fecha técnico ${tecnico.posicion}`}
          value={form.fecha}
          onChange={(e) => guardarCampo('fecha', e.target.value)}
        />
      </div>
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
  onGuardar: (cambios: { nombre?: string; firma?: string; fecha?: string }) => void
}) {
  const [borradorNombre, setBorradorNombre] = useSyncedState(nombre)
  const [borradorFirma, setBorradorFirma] = useSyncedState(firma)
  const [borradorFecha, setBorradorFecha] = useSyncedState(fecha)

  const vacio = nombreObligatorio && borradorNombre.trim() === ''

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 font-body text-sm font-semibold text-concreto-oscuro">
        {titulo}
        {nombreObligatorio && (
          <WarningTooltip texto="El nombre del Responsable de Mantenimiento es obligatorio para poder confirmar la ficha.">
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
        <input
          type="date"
          className={CLASE_INPUT}
          aria-label={`Fecha ${titulo}`}
          value={borradorFecha}
          onChange={(e) => {
            setBorradorFecha(e.target.value)
            onGuardar({ fecha: e.target.value })
          }}
        />
      </div>
    </div>
  )
}
