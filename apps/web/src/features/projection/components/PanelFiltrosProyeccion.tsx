import { GlassChip } from '../../../components/GlassChip'
import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { ModoCombinacionToggle } from '../../../components/ModoCombinacionToggle'
import { MultiSelect } from '../../../components/MultiSelect'
import { RangoNumerico } from '../../../components/RangoNumerico'
import { useScanRecordsValoresDistintos } from '../../scan-records/queries'
import type { EstadoDisco, LadoDisco } from '../../scan-records/types'
import { contarFiltrosActivosProyeccion, type FiltrosStateProyeccion } from '../filtros'

// Incluye REPERFILADO — a diferencia de wear-rate/pairs, acá el disco SÍ
// tiene H por fila (última medición), así que el quinto estado es un
// resultado real y esperado (ver clasificarEstadoConReperfilado).
const ESTADOS: { v: EstadoDisco; label: string }[] = [
  { v: 'OK', label: 'OK' },
  { v: 'SEGUIMIENTO', label: 'Seguimiento' },
  { v: 'CAMBIO', label: 'Cambio' },
  { v: 'CRITICO', label: 'Crítico' },
  { v: 'REPERFILADO', label: 'Reperfilado' },
]

// MultiSelect trabaja con string[] planos — mismo criterio que LADOS en
// scan-records/components/PanelFiltros.tsx.
const LADOS: LadoDisco[] = ['izquierdo', 'derecho']

const RANGOS: { campoMin: keyof FiltrosStateProyeccion; campoMax: keyof FiltrosStateProyeccion; label: string }[] = [
  { campoMin: 'hMin', campoMax: 'hMax', label: 'H' },
  { campoMin: 'tMin', campoMax: 'tMax', label: 'T' },
  { campoMin: 'rdMin', campoMax: 'rdMax', label: 'Rd' },
  { campoMin: 'ejeMin', campoMax: 'ejeMax', label: 'Eje' },
  { campoMin: 'ruedaMin', campoMax: 'ruedaMax', label: 'Rueda' },
]

type Props = {
  filtros: FiltrosStateProyeccion
  onCambiar: (patch: Partial<FiltrosStateProyeccion>) => void
  onLimpiar: () => void
  disabled?: boolean
}

// Panel de filtros de /projection/discos — mismos componentes genéricos que
// el resto de paneles de filtros del sistema (GlassChip, GlassDatePicker,
// ModoCombinacionToggle, MultiSelect, RangoNumerico) — el mismo patrón
// compartido que ya usa Mediciones confirmadas (ver
// scan-records/components/PanelFiltros.tsx), solo con el subconjunto de
// filtros que aplica al contexto de Proyección (eje/rueda/lado sí, motivo/
// responsable de la ÚLTIMA MEDICIÓN sí, vistaFecha NO — la proyección
// siempre parte de la medición más reciente, no hay "vista" que alternar).
// Motivo/responsable se pueblan del mismo catálogo de confirmados que
// Mediciones (alcance {} — Proyección nunca corre sobre un borrador de
// migración). Solo afecta la tabla principal: nunca el pronóstico de 12
// meses ni las tarjetas de promedio por vagón (ver Proyeccion.tsx).
export function PanelFiltrosProyeccion({ filtros, onCambiar, onLimpiar, disabled }: Props) {
  const activos = contarFiltrosActivosProyeccion(filtros)
  const motivos = useScanRecordsValoresDistintos({}, 'motivo')
  const responsables = useScanRecordsValoresDistintos({}, 'responsable')

  function alternarEstado(e: EstadoDisco) {
    const has = filtros.estado.includes(e)
    onCambiar({ estado: has ? filtros.estado.filter((x) => x !== e) : [...filtros.estado, e] })
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
              ? 'El disco cumple TODOS los filtros activos.'
              : 'El disco cumple CUALQUIERA de los filtros activos.'}
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

      {/* Multi-selects lado / motivo / responsable (de la última medición) */}
      <div className="grid gap-3 sm:grid-cols-3">
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
        <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">Estado</p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e) => (
            <GlassChip key={e.v} activo={filtros.estado.includes(e.v)} disabled={disabled} onClick={() => alternarEstado(e.v)}>
              {e.label}
            </GlassChip>
          ))}
        </div>
      </div>

      {/* Dos rangos de fecha independientes: Siguiente Reperfilado / Siguiente Cambio */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex items-end gap-2">
          <GlassDatePicker
            label="Siguiente reperfilado desde"
            value={filtros.siguienteReperfiladoDesde}
            onChange={(iso) => onCambiar({ siguienteReperfiladoDesde: iso })}
            disabled={disabled}
            className="w-[11.5rem]"
          />
          <span className="pb-2.5 font-body text-sm text-concreto">→</span>
          <GlassDatePicker
            label="Siguiente reperfilado hasta"
            value={filtros.siguienteReperfiladoHasta}
            onChange={(iso) => onCambiar({ siguienteReperfiladoHasta: iso })}
            disabled={disabled}
            className="w-[11.5rem]"
          />
        </div>

        <div className="flex items-end gap-2">
          <GlassDatePicker
            label="Siguiente cambio desde"
            value={filtros.siguienteCambioDesde}
            onChange={(iso) => onCambiar({ siguienteCambioDesde: iso })}
            disabled={disabled}
            className="w-[11.5rem]"
          />
          <span className="pb-2.5 font-body text-sm text-concreto">→</span>
          <GlassDatePicker
            label="Siguiente cambio hasta"
            value={filtros.siguienteCambioHasta}
            onChange={(iso) => onCambiar({ siguienteCambioHasta: iso })}
            disabled={disabled}
            className="w-[11.5rem]"
          />
        </div>
      </div>

      {/* Rangos numéricos H / T / Rd / Eje / Rueda */}
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
              onCambiarMin={(v) => onCambiar({ [r.campoMin]: v } as Partial<FiltrosStateProyeccion>)}
              onCambiarMax={(v) => onCambiar({ [r.campoMax]: v } as Partial<FiltrosStateProyeccion>)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
