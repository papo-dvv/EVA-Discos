import { GlassDatePicker } from '../../../components/GlassDatePicker'
import { GlassField } from '../../../components/GlassField'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { aFechaCorta } from '../fecha'
import type { CambiosFicha, FichaMedicion, ReferenciaUltimaMedicion } from '../types'

type Props = {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
  // true tras POST .../lock (ver MeasurementSheet.tablaBloqueada): Fecha/
  // Tren/Kilometraje pasan a solo-lectura — es la identidad "congelada" de la
  // ficha, el backend rechaza con 423 cualquier intento de editarlos.
  deshabilitada?: boolean
  // Flags a nivel FICHA (mismo valor en toda fila — ver ScanRecord.kmInvalido/
  // fechaInvalido): true si el header ya no es válido contra el historial
  // confirmado del tren. `referencia` es la "última medición" de ese tren
  // (mismo GET .../reference que alimenta las alertas por fila y el modal de
  // Medición Anterior) — permite mostrar el valor previo exacto en el banner.
  kmInvalido?: boolean
  fechaInvalido?: boolean
  referencia?: ReferenciaUltimaMedicion
}

// Header fijo de la ficha (punto 2a del enunciado): actividad y unidad son
// texto fijo, no editable; Fecha/Tren/Kilometraje se autocompletan al cargar
// el CSV (o quedan en blanco/el valor dado en el alta manual) y siguen
// editables — cada uno se guarda al perder el foco (mismo criterio que
// FilaParametro: solo dispara el PATCH si el valor realmente cambió).
export function HeaderFicha({
  ficha,
  onGuardar,
  deshabilitada = false,
  kmInvalido = false,
  fechaInvalido = false,
  referencia,
}: Props) {
  const [fecha, setFecha] = useSyncedState(aFechaCorta(ficha.fechaFicha))
  const [tren, setTren] = useSyncedState(String(ficha.trenNumero))
  const [kilometraje, setKilometraje] = useSyncedState(String(ficha.kilometraje))

  // Discrepancia = el valor actual (editado o no) difiere del que trajo el
  // CSV — ficha.corregidoTren/corregidoKilometraje ya reflejan justo esto tal
  // como lo dejó el último PATCH aceptado por el backend.
  const discrepanciaTren = ficha.corregidoTren && ficha.trenOriginalCsv !== null
  const discrepanciaKm = ficha.corregidoKilometraje && ficha.kilometrajeOriginalCsv !== null

  return (
    <div className="space-y-4">
      {(kmInvalido || fechaInvalido) && (
        <div
          role="alert"
          className="rounded-2xl border border-[color:var(--color-estado-critico)]/40 bg-[color:var(--color-estado-critico)]/10 px-4 py-3 font-body text-sm text-concreto-oscuro"
        >
          ⚠️{' '}
          {kmInvalido && (
            <>
              El Kilometraje ({ficha.kilometraje}) es menor al último confirmado de este tren
              {referencia ? ` (${referencia.kilometraje} km, ${referencia.fecha})` : ''}.{' '}
            </>
          )}
          {fechaInvalido && (
            <>
              La Fecha ({fecha || '—'}) es anterior a la última confirmada de este tren
              {referencia ? ` (${referencia.fecha})` : ''}.
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="lg:col-span-2">
          <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Actividad
          </p>
          <p className="font-display text-sm font-semibold text-concreto-oscuro">
            ACTIVIDAD: {ficha.actividad}
          </p>
        </div>

        <GlassDatePicker
          label="Fecha"
          value={fecha}
          disabled={deshabilitada}
          onChange={(iso) => {
            setFecha(iso)
            if (iso && iso !== aFechaCorta(ficha.fechaFicha)) onGuardar({ fechaFicha: iso })
          }}
        />

        <div className="flex items-end gap-1.5">
          <GlassField
            label="Tren"
            type="number"
            min={6}
            max={44}
            value={tren}
            disabled={deshabilitada}
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
            disabled={deshabilitada}
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
    </div>
  )
}
