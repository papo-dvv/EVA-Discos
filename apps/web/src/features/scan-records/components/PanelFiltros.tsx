import { GlassChip } from '../../../components/GlassChip'
import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { ModoCombinacionToggle } from '../../../components/ModoCombinacionToggle'
import { MultiSelect } from '../../../components/MultiSelect'
import { RangoNumerico } from '../../../components/RangoNumerico'
import { SegmentedControl } from '../../../components/SegmentedControl'
import { Switch } from '../../../components/Switch'
import type { AlcanceScanRecords, EstadoDisco, LadoDisco, OpcionesFiltro, VistaFecha } from '../types'
import { contarFiltrosActivos, type FiltrosState } from '../filtros'
import { useScanRecordsValoresDistintos } from '../queries'

const ESTADOS: { v: EstadoDisco; label: string }[] = [
  { v: 'OK', label: 'OK' },
  { v: 'SEGUIMIENTO', label: 'Seguimiento' },
  { v: 'CAMBIO', label: 'Cambio' },
  { v: 'CRITICO', label: 'Crítico' },
  { v: 'REPERFILADO', label: 'Reperfilado' },
]

// MultiSelect trabaja con string[] planos (mismo criterio que LADOS en
// wear-rate/components/PanelFiltrosWearRate.tsx) — 'izquierdo'/'derecho' se
// muestran tal cual, sin mapeo de etiqueta aparte.
const LADOS: LadoDisco[] = ['izquierdo', 'derecho']

const VISTAS_FECHA_OPCIONES: { valor: VistaFecha; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'ultima', etiqueta: 'Última' },
  { valor: 'primera', etiqueta: 'Primera' },
]

const RANGOS: { campoMin: keyof FiltrosState; campoMax: keyof FiltrosState; label: string }[] = [
  { campoMin: 'kilometrajeMin', campoMax: 'kilometrajeMax', label: 'Kilometraje' },
  { campoMin: 'hMin', campoMax: 'hMax', label: 'H' },
  { campoMin: 'tMin', campoMax: 'tMax', label: 'T' },
  { campoMin: 'rdMin', campoMax: 'rdMax', label: 'Rd' },
  { campoMin: 'ejeMin', campoMax: 'ejeMax', label: 'Eje' },
  { campoMin: 'ruedaMin', campoMax: 'ruedaMax', label: 'Rueda' },
]

type Props = {
  filtros: FiltrosState
  onCambiar: (patch: Partial<FiltrosState>) => void
  onLimpiar: () => void
  opciones?: OpcionesFiltro
  disabled?: boolean
  // Determina si los dropdowns de Motivo/Responsable pegan a
  // /migration/:fileId/valores-distintos o a /scan-records/valores-distintos
  // (ver useScanRecordsValoresDistintos) — mismo criterio mode-aware que el
  // resto del feature. Ausente = alcance de confirmados ({}).
  alcance?: AlcanceScanRecords
}

export function PanelFiltros({ filtros, onCambiar, onLimpiar, opciones, disabled, alcance = {} }: Props) {
  const activos = contarFiltrosActivos(filtros)
  const motivos = useScanRecordsValoresDistintos(alcance, 'motivo')
  const responsables = useScanRecordsValoresDistintos(alcance, 'responsable')

  function alternarEstado(e: EstadoDisco) {
    const has = filtros.estado.includes(e)
    onCambiar({
      estado: has ? filtros.estado.filter((x) => x !== e) : [...filtros.estado, e],
    })
  }

  return (
    <div className="space-y-4">
      {/* Cabecera: modo de combinación + limpiar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ModoCombinacionToggle
            valor={filtros.modoCombinacion}
            onCambiar={(modo) => onCambiar({ modoCombinacion: modo })}
          />
          <p className="font-body text-xs text-concreto">
            {filtros.modoCombinacion === 'AND'
              ? 'La fila cumple TODOS los filtros activos.'
              : 'La fila cumple CUALQUIERA de los filtros activos.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onLimpiar}
          disabled={activos === 0}
          className="rounded-full border border-concreto/30 px-4 py-1.5 font-body text-xs text-concreto-oscuro transition-colors hover:bg-white/60 disabled:opacity-40"
        >
          Limpiar filtros{activos > 0 ? ` (${activos})` : ''}
        </button>
      </div>

      {/* Vista de fecha: colapsa a 1 fila por disco (última/primera) o
          mantiene todo el histórico ('todas', default) — no cuenta como
          filtro activo (es un modo de vista, no una condición). */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Vista de fecha
        </p>
        <SegmentedControl
          ariaLabel="Vista de fecha"
          opciones={VISTAS_FECHA_OPCIONES}
          valor={filtros.vistaFecha}
          onCambiar={(v) => onCambiar({ vistaFecha: v })}
        />
        {filtros.vistaFecha !== 'todas' && (
          <p className="font-body text-xs text-concreto">
            Mostrando solo la medición{' '}
            {filtros.vistaFecha === 'ultima' ? 'más reciente' : 'más antigua'} de cada disco.
          </p>
        )}
      </div>

      {/* Multi-selects coche / bogie / lado / motivo / responsable */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MultiSelect
          label="Tipo de coche"
          opciones={opciones?.tiposCoche ?? []}
          seleccion={filtros.tipoCoche}
          onCambiar={(v) => onCambiar({ tipoCoche: v })}
          disabled={disabled}
        />
        <MultiSelect
          label="Bogie"
          opciones={opciones?.bogies ?? []}
          seleccion={filtros.bogieCodigo}
          onCambiar={(v) => onCambiar({ bogieCodigo: v })}
          disabled={disabled}
        />
        <MultiSelect
          label="Lado"
          opciones={LADOS}
          seleccion={filtros.lado}
          onCambiar={(v) => onCambiar({ lado: v as LadoDisco[] })}
          disabled={disabled}
        />
        <MultiSelect
          label="Motivo"
          opciones={motivos.data ?? []}
          seleccion={filtros.motivo}
          onCambiar={(v) => onCambiar({ motivo: v })}
          disabled={disabled || motivos.isLoading}
        />
        <MultiSelect
          label="Responsable"
          opciones={responsables.data ?? []}
          seleccion={filtros.responsable}
          onCambiar={(v) => onCambiar({ responsable: v })}
          disabled={disabled || responsables.isLoading}
        />
      </div>

      {/* Estado (chips multi-choice) */}
      <div>
        <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Estado
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e) => (
            <GlassChip
              key={e.v}
              activo={filtros.estado.includes(e.v)}
              disabled={disabled}
              onClick={() => alternarEstado(e.v)}
            >
              {e.label}
            </GlassChip>
          ))}
        </div>
      </div>

      {/* Toggle corregidos/advertencia + rango de fecha */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Switch
          checked={filtros.corregidoOAdvertencia}
          onChange={(v) => onCambiar({ corregidoOAdvertencia: v })}
          label="Corregidos o con advertencia"
        />

        <div className="flex items-end gap-2">
          <GlassDatePicker
            label="Fecha desde"
            value={filtros.fechaDesde}
            onChange={(iso) => onCambiar({ fechaDesde: iso })}
            disabled={disabled}
            className="w-[10.5rem]"
          />
          <span className="pb-2.5 font-body text-sm text-concreto">→</span>
          <GlassDatePicker
            label="Fecha hasta"
            value={filtros.fechaHasta}
            onChange={(iso) => onCambiar({ fechaHasta: iso })}
            disabled={disabled}
            className="w-[10.5rem]"
          />
        </div>
      </div>

      {/* Rangos numéricos */}
      <div>
        <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Rangos numéricos (mín / máx)
        </p>
        <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {RANGOS.map((r) => (
            <RangoNumerico
              key={r.label}
              label={r.label}
              valorMin={filtros[r.campoMin] as string}
              valorMax={filtros[r.campoMax] as string}
              onCambiarMin={(v) => onCambiar({ [r.campoMin]: v } as Partial<FiltrosState>)}
              onCambiarMax={(v) => onCambiar({ [r.campoMax]: v } as Partial<FiltrosState>)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
