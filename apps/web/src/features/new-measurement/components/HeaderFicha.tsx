import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { GlassField } from '../../../components/GlassField'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { aFechaCorta } from '../fecha'
import type { CambiosFicha, FichaMedicion } from '../types'

type Props = {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
}

// Header fijo de la ficha (punto 2a del enunciado): actividad y unidad son
// texto fijo, no editable; Fecha/Tren/Kilometraje se autocompletan al cargar
// el CSV (o quedan en blanco/el valor dado en el alta manual) y siguen
// editables — cada uno se guarda al perder el foco (mismo criterio que
// FilaParametro: solo dispara el PATCH si el valor realmente cambió).
export function HeaderFicha({ ficha, onGuardar }: Props) {
  const [fecha, setFecha] = useSyncedState(aFechaCorta(ficha.fechaFicha))
  const [tren, setTren] = useSyncedState(String(ficha.trenNumero))
  const [kilometraje, setKilometraje] = useSyncedState(String(ficha.kilometraje))

  // Discrepancia = el valor actual (editado o no) difiere del que trajo el
  // CSV — ficha.corregidoTren/corregidoKilometraje ya reflejan justo esto tal
  // como lo dejó el último PATCH aceptado por el backend.
  const discrepanciaTren = ficha.corregidoTren && ficha.trenOriginalCsv !== null
  const discrepanciaKm = ficha.corregidoKilometraje && ficha.kilometrajeOriginalCsv !== null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="lg:col-span-2">
        <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Actividad
        </p>
        <p className="font-display text-sm font-semibold text-concreto-oscuro">
          ACTIVIDAD: {ficha.actividad}
        </p>
      </div>

      <GlassDatePicker label="Fecha" value={fecha} onChange={(iso) => {
        setFecha(iso)
        if (iso && iso !== aFechaCorta(ficha.fechaFicha)) onGuardar({ fechaFicha: iso })
      }} />

      <div className="flex items-end gap-1.5">
        <GlassField
          label="Tren"
          type="number"
          min={6}
          max={44}
          value={tren}
          onChange={(e) => setTren(e.target.value)}
          onBlur={() => {
            const n = Number(tren)
            if (tren.trim() !== '' && Number.isFinite(n) && n !== ficha.trenNumero) onGuardar({ trenNumero: n })
          }}
          contenedorClassName="flex-1"
        />
        {discrepanciaTren && (
          <WarningTooltip
            texto={`El CSV traía el tren ${ficha.trenOriginalCsv}; se está usando ${ficha.trenNumero}.`}
            className="mb-3"
          >
            ⚠️
          </WarningTooltip>
        )}
      </div>

      <div>
        <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Unidad
        </p>
        <p className="font-display text-sm font-semibold text-concreto-oscuro">mm · CONTROL DISCO DE FRENO</p>
      </div>

      <div className="flex items-end gap-1.5">
        <GlassField
          label="Kilometraje"
          type="number"
          step="any"
          value={kilometraje}
          onChange={(e) => setKilometraje(e.target.value)}
          onBlur={() => {
            const n = Number(kilometraje)
            if (kilometraje.trim() !== '' && Number.isFinite(n) && n !== ficha.kilometraje) {
              onGuardar({ kilometraje: n })
            }
          }}
          contenedorClassName="flex-1"
        />
        {discrepanciaKm && (
          <WarningTooltip
            texto={`El CSV traía ${ficha.kilometrajeOriginalCsv} km; se está usando ${ficha.kilometraje} km.`}
            className="mb-3"
          >
            ⚠️
          </WarningTooltip>
        )}
      </div>
    </div>
  )
}
