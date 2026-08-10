import { GlassSurface } from '../../../components/GlassSurface'
import type { DesgloseEstado, PronosticoMes } from '../types'

const SEGMENTOS: { clave: keyof DesgloseEstado; etiqueta: string; color: string }[] = [
  { clave: 'ok', etiqueta: 'OK', color: 'var(--color-estado-ok)' },
  { clave: 'seguimiento', etiqueta: 'Seguimiento', color: 'var(--color-estado-seguimiento)' },
  { clave: 'cambio', etiqueta: 'Cambio', color: 'var(--color-estado-cambio)' },
  { clave: 'critico', etiqueta: 'Crítico', color: 'var(--color-estado-critico)' },
  { clave: 'reperfilado', etiqueta: 'Reperfilado', color: 'var(--color-estado-reperfilado)' },
]

// Mini barra apilada CSS (sin librería de gráficos — el proyecto no tiene
// ninguna instalada, ver GlassDatePicker por el mismo criterio): un flex de
// segmentos de ancho proporcional al conteo de cada estado AMPLIADO
// proyectado. Estos SÍ son los colores semánticos de salud de disco (a
// diferencia de la tarjeta de tasa promedio): acá se está mostrando
// justamente un desglose de estados de disco, es el uso correcto.
function BarraEstados({ desglose }: { desglose: DesgloseEstado }) {
  const total = desglose.ok + desglose.seguimiento + desglose.cambio + desglose.critico + desglose.reperfilado
  if (total === 0) {
    return <p className="font-body text-xs text-concreto">Sin discos proyectables</p>
  }
  return (
    <div className="flex h-4 w-full min-w-[9rem] overflow-hidden rounded-full bg-white/40">
      {SEGMENTOS.filter((s) => desglose[s.clave] > 0).map((s) => (
        <div
          key={s.clave}
          title={`${s.etiqueta}: ${desglose[s.clave]}`}
          style={{ width: `${(desglose[s.clave] / total) * 100}%`, background: s.color }}
        />
      ))}
    </div>
  )
}

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {SEGMENTOS.map((s) => (
        <span key={s.clave} className="flex items-center gap-1.5 font-body text-xs text-concreto">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.etiqueta}
        </span>
      ))}
    </div>
  )
}

type Props = {
  meses?: PronosticoMes[]
  cargando: boolean
}

// Pronóstico a 12 meses: una fila por mes calendario (empezando hoy), con
// cuántos reperfilados/cambios se proyectan en ese mes y el desglose de
// estado AMPLIADO de la flota a esa fecha (H/Rd interpolados, no el estado
// actual — ver ProyeccionService.obtenerPronostico12Meses en el backend).
export function TablaPronostico12Meses({ meses, cargando }: Props) {
  return (
    <GlassSurface fuerte className="mt-4 overflow-hidden rounded-glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-concreto-oscuro">Pronóstico a 12 meses</h3>
          <p className="mt-0.5 font-body text-xs text-concreto">
            Reperfilados y cambios proyectados, mes a mes, sobre el alcance actual.
          </p>
        </div>
        <Leyenda />
      </div>

      {cargando ? (
        <p className="font-body text-sm text-concreto">Cargando…</p>
      ) : !meses || meses.length === 0 ? (
        <p className="font-body text-sm text-concreto">Sin datos de pronóstico.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left font-body text-sm">
            <thead>
              <tr className="border-b border-concreto/20">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-concreto">Mes</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
                  Reperfilados
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-concreto">
                  Cambios
                </th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-concreto">
                  Estado proyectado de la flota
                </th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="tabla-fila--glass border-b border-concreto/10">
                  <td className="px-3 py-2.5 font-data text-concreto-oscuro">{m.mes}</td>
                  <td className="px-3 py-2.5 text-right font-data text-concreto-oscuro">{m.reperfilados}</td>
                  <td className="px-3 py-2.5 text-right font-data text-concreto-oscuro">{m.cambios}</td>
                  <td className="px-3 py-2.5">
                    <BarraEstados desglose={m.desgloseEstado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassSurface>
  )
}
