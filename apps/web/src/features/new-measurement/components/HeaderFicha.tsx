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
  // Tren/Kilometraje/P.T. pasan a solo-lectura — es la identidad "congelada"
  // de la ficha, el backend rechaza con 423 cualquier intento de editarlos.
  deshabilitada?: boolean
  // A nivel FICHA (mismo problema para toda la ficha, ver PreviewFichaResult/
  // ResumenVerificacion, backend), con motivo legible — null cuando ese
  // problema no está activo. Se muestran ÚNICAMENTE acá, como WarningTooltip
  // pegado al campo correspondiente (Kilometraje/Fecha) — nunca replicados en
  // la tabla espejo (ver TablaFichaEspejo, que ya no conoce estos 2 flags).
  kmInvalido?: { motivo: string } | null
  fechaInvalido?: { motivo: string } | null
  // Última medición confirmada de este tren (mismo GET .../reference que
  // alimenta el modal de Medición Anterior) — permite mostrar el valor previo
  // exacto en el tooltip de la alerta.
  referencia?: ReferenciaUltimaMedicion
}

// Header fijo de la ficha (punto 2a del enunciado): actividad y unidad son
// texto fijo, no editable; Fecha/Tren/Kilometraje se autocompletan al cargar
// el CSV (o quedan en blanco/el valor dado en el alta manual) y siguen
// editables — cada uno se guarda al perder el foco (mismo criterio que
// FilaParametro: solo dispara el PATCH si el valor realmente cambió). P.T.
// (Puesto de Trabajo) es SIEMPRE manual — el CSV nunca lo trae — y
// obligatorio para poder bloquear/confirmar la ficha (mismo indicador visual
// que Responsable de Mantenimiento en FooterFicha).
export function HeaderFicha({
  ficha,
  onGuardar,
  deshabilitada = false,
  kmInvalido = null,
  fechaInvalido = null,
  referencia,
}: Props) {
  const [fecha, setFecha] = useSyncedState(aFechaCorta(ficha.fechaFicha))
  const [tren, setTren] = useSyncedState(String(ficha.trenNumero))
  const [kilometraje, setKilometraje] = useSyncedState(String(ficha.kilometraje))
  const [ptCodigo, setPtCodigo] = useSyncedState(ficha.ptCodigo ?? '')

  // Discrepancia = el valor actual (editado o no) difiere del que trajo el
  // CSV — ficha.corregidoTren/corregidoKilometraje ya reflejan justo esto tal
  // como lo dejó el último PATCH aceptado por el backend.
  const discrepanciaTren = ficha.corregidoTren && ficha.trenOriginalCsv !== null
  const discrepanciaKm = ficha.corregidoKilometraje && ficha.kilometrajeOriginalCsv !== null
  const ptVacio = !ficha.ptCodigo?.trim()

  return (
    <div className="space-y-4">
      {/* Grilla de 4 columnas a propósito (punto 1 del enunciado): fila 1
          tiene exactamente 4 campos (Actividad/Fecha/Tren/Unidad) y fila 2
          solo 2 (P.T./Kilometraje) — con el mismo grid-cols-4, el auto-flow
          los ubica en las columnas 1-2 de la fila siguiente, con el mismo
          ancho que el resto de los inputs, sin flotar centrados. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
        <div>
          <p className="mb-1.5 font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
            Actividad
          </p>
          <p className="font-display text-sm font-semibold text-concreto-oscuro">
            ACTIVIDAD: {ficha.actividad}
          </p>
        </div>

        <div className="flex items-end gap-1.5">
          <GlassDatePicker
            label="Fecha"
            value={fecha}
            disabled={deshabilitada}
            onChange={(iso) => {
              setFecha(iso)
              if (iso && iso !== aFechaCorta(ficha.fechaFicha)) onGuardar({ fechaFicha: iso })
            }}
            className="flex-1"
          />
          {fechaInvalido && (
            <WarningTooltip
              texto={`${fechaInvalido.motivo}${referencia ? ' — última confirmada: ' + referencia.fecha + '.' : '.'}`}
              className="mb-3"
            >
              ⚠️
            </WarningTooltip>
          )}
        </div>

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
            label={
              <span className="inline-flex items-center gap-1">
                P.T.
                <WarningTooltip texto="El P.T. (Puesto de Trabajo) es obligatorio para poder bloquear y confirmar la ficha.">
                  <span className="text-[color:var(--color-estado-critico)]">*</span>
                </WarningTooltip>
              </span>
            }
            type="text"
            value={ptCodigo}
            disabled={deshabilitada}
            aria-required
            onChange={(e) => setPtCodigo(e.target.value)}
            onBlur={() => {
              if (ptCodigo !== (ficha.ptCodigo ?? '')) onGuardar({ ptCodigo })
            }}
            className={ptVacio ? 'ring-1 ring-[color:var(--color-estado-critico)]/50' : ''}
            contenedorClassName="flex-1"
          />
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
          {kmInvalido && (
            <WarningTooltip
              texto={`${kmInvalido.motivo}${referencia ? ' — último confirmado: ' + referencia.kilometraje + ' km.' : '.'}`}
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
