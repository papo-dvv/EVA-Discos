import { GlassChip } from '../../../components/GlassChip'
import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { ModoCombinacionToggle } from '../../../components/ModoCombinacionToggle'
import { MultiSelect } from '../../../components/MultiSelect'
import { RangoNumerico } from '../../../components/RangoNumerico'
import { Switch } from '../../../components/Switch'
import type { AccionRecomendada, EstadoDisco, OpcionesFiltro } from '../../scan-records/types'
import { contarFiltrosActivosWearRate, type FiltrosStateWearRate } from '../filtros'

const LADOS = ['izquierdo', 'derecho']
const MOTIVOS_FECHA2 = ['Medición', 'Reperfilado', 'Cambio']

// Mismas 4/3 opciones y mismo criterio que PanelFiltros (scan-records): acá
// SÍ se traduce a un WHERE de rd2 (estado) o se resuelve cruzando discos
// (accionRecomendada) — ver rangoRd2ParaEstado/resolverAccionPorDiscId en el
// backend — pero desde la UI se filtran exactamente igual.
const ESTADOS: { v: EstadoDisco; label: string }[] = [
  { v: 'OK', label: 'OK' },
  { v: 'SEGUIMIENTO', label: 'Seguimiento' },
  { v: 'CAMBIO', label: 'Cambio' },
  { v: 'CRITICO', label: 'Crítico' },
]
const ACCIONES: { v: Exclude<AccionRecomendada, 'NINGUNA'>; label: string }[] = [
  { v: 'CRITICO', label: 'Crítico' },
  { v: 'CAMBIO', label: 'Cambio' },
  { v: 'REPERFILADO', label: 'Reperfilado' },
]

const RANGOS: { campoMin: keyof FiltrosStateWearRate; campoMax: keyof FiltrosStateWearRate; label: string }[] = [
  { campoMin: 'km1Min', campoMax: 'km1Max', label: 'Km 1' },
  { campoMin: 'km2Min', campoMax: 'km2Max', label: 'Km 2' },
  { campoMin: 'rd1Min', campoMax: 'rd1Max', label: 'Rd 1' },
  { campoMin: 'rd2Min', campoMax: 'rd2Max', label: 'Rd 2' },
  { campoMin: 'diferenciaKmMin', campoMax: 'diferenciaKmMax', label: 'Diferencia de Km' },
  { campoMin: 'diferenciaRdMin', campoMax: 'diferenciaRdMax', label: 'Diferencia de Rd' },
  { campoMin: 'tasaMin', campoMax: 'tasaMax', label: 'Tasa' },
  { campoMin: 'tasaMensualMin', campoMax: 'tasaMensualMax', label: 'Tasa mensual' },
  { campoMin: 'ejeNumeroMin', campoMax: 'ejeNumeroMax', label: 'Eje' },
]

type Props = {
  filtros: FiltrosStateWearRate
  onCambiar: (patch: Partial<FiltrosStateWearRate>) => void
  onLimpiar: () => void
  opciones?: OpcionesFiltro
  disabled?: boolean
}

// Panel de filtros de /wear-rate/pairs — mismos componentes genéricos del
// panel de filtros de mediciones (MultiSelect, GlassDatePicker,
// ModoCombinacionToggle, RangoNumerico, Switch), solo con la lista de
// columnas/opciones propia de pares de tasa de desgaste. Estos filtros solo
// afectan esta tabla: ver TasaDesgaste.tsx, donde el gráfico y el resumen
// usan queries independientes que nunca reciben este estado.
export function PanelFiltrosWearRate({ filtros, onCambiar, onLimpiar, opciones, disabled }: Props) {
  const activos = contarFiltrosActivosWearRate(filtros)

  function alternarEstado(e: EstadoDisco) {
    const has = filtros.estado.includes(e)
    onCambiar({
      estado: has ? filtros.estado.filter((x) => x !== e) : [...filtros.estado, e],
    })
  }

  function alternarAccion(a: Exclude<AccionRecomendada, 'NINGUNA'>) {
    const has = filtros.accionRecomendada.includes(a)
    onCambiar({
      accionRecomendada: has
        ? filtros.accionRecomendada.filter((x) => x !== a)
        : [...filtros.accionRecomendada, a],
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

      {/* Multi-selects: coche / bogie / lado / motivo de fecha 2 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          onCambiar={(v) => onCambiar({ lado: v })}
          disabled={disabled}
        />
        <MultiSelect
          label="Motivo de fecha 2"
          opciones={MOTIVOS_FECHA2}
          seleccion={filtros.motivoFecha2}
          onCambiar={(v) => onCambiar({ motivoFecha2: v })}
          disabled={disabled}
        />
      </div>

      {/* Estado + Acción recomendada (chips multi-choice) */}
      <div className="grid gap-3 sm:grid-cols-2">
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
        <div>
          <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Acción recomendada
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCIONES.map((a) => (
              <GlassChip
                key={a.v}
                activo={filtros.accionRecomendada.includes(a.v)}
                disabled={disabled}
                onClick={() => alternarAccion(a.v)}
              >
                {a.label}
              </GlassChip>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle solo inválidos + dos rangos de fecha independientes */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Switch
          checked={filtros.soloInvalidos}
          onChange={(v) => onCambiar({ soloInvalidos: v })}
          label="Solo inválidos"
        />

        <div className="flex items-end gap-2">
          <GlassDatePicker
            label="Fecha 1 desde"
            value={filtros.fecha1Desde}
            onChange={(iso) => onCambiar({ fecha1Desde: iso })}
            disabled={disabled}
            className="w-[10.5rem]"
          />
          <span className="pb-2.5 font-body text-sm text-concreto">→</span>
          <GlassDatePicker
            label="Fecha 1 hasta"
            value={filtros.fecha1Hasta}
            onChange={(iso) => onCambiar({ fecha1Hasta: iso })}
            disabled={disabled}
            className="w-[10.5rem]"
          />
        </div>

        <div className="flex items-end gap-2">
          <GlassDatePicker
            label="Fecha 2 desde"
            value={filtros.fecha2Desde}
            onChange={(iso) => onCambiar({ fecha2Desde: iso })}
            disabled={disabled}
            className="w-[10.5rem]"
          />
          <span className="pb-2.5 font-body text-sm text-concreto">→</span>
          <GlassDatePicker
            label="Fecha 2 hasta"
            value={filtros.fecha2Hasta}
            onChange={(iso) => onCambiar({ fecha2Hasta: iso })}
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
              onCambiarMin={(v) => onCambiar({ [r.campoMin]: v } as Partial<FiltrosStateWearRate>)}
              onCambiarMax={(v) => onCambiar({ [r.campoMax]: v } as Partial<FiltrosStateWearRate>)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
