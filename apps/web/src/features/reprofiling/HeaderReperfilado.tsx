import { GlassDatePicker } from '../../components/GlassDatePicker'
import { GlassField } from '../../components/GlassField'
import { useSyncedState } from '../../hooks/useSyncedState'
import { aFechaCorta } from '../new-measurement/fecha'
import type { CambiosFicha, FichaMedicion } from '../new-measurement/types'

export function HeaderReperfilado({
  ficha,
  onGuardar,
  deshabilitada = false,
}: {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
  deshabilitada?: boolean
}) {
  const [fecha, setFecha] = useSyncedState(aFechaCorta(ficha.fechaFicha))
  const [tren, setTren] = useSyncedState(String(ficha.trenNumero))
  const [km, setKm] = useSyncedState(String(ficha.kilometraje))
  const [pt, setPt] = useSyncedState(ficha.puestoTrabajo ?? '')
  const [inicio, setInicio] = useSyncedState(
    ficha.fechaHoraInicio?.slice(0, 16) ?? '',
  )
  const [fin, setFin] = useSyncedState(ficha.fechaHoraFin?.slice(0, 16) ?? '')

  return (
    <div className="space-y-4">
      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto">
          Actividad
        </p>
        <p className="mt-1 font-display text-sm font-semibold text-concreto-oscuro">
          {ficha.actividad}
        </p>
        <p className="mt-1 font-body text-xs text-concreto">
          Marca: ALSTOM METROPOLIS S9000
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassField
          label="Tren *"
          required
          type="number"
          min={6}
          max={44}
          disabled={deshabilitada}
          value={tren}
          onChange={(e) => setTren(e.target.value)}
          onBlur={() => {
            const n = Number(tren)
            if (Number.isFinite(n) && n !== ficha.trenNumero)
              onGuardar({ trenNumero: n })
          }}
        />
        <GlassField
          label="Kilometraje *"
          required
          type="number"
          step="any"
          disabled={deshabilitada}
          value={km}
          onChange={(e) => setKm(e.target.value)}
          onBlur={() => {
            const n = Number(km)
            if (Number.isFinite(n) && n !== ficha.kilometraje)
              onGuardar({ kilometraje: n })
          }}
        />
        <GlassField
          label="P.T. *"
          required
          placeholder="Puesto de trabajo"
          disabled={deshabilitada}
          value={pt}
          onChange={(e) => setPt(e.target.value)}
          onBlur={() => {
            if (pt !== (ficha.puestoTrabajo ?? ''))
              onGuardar({ puestoTrabajo: pt })
          }}
        />
        <GlassDatePicker
          label="Fecha *"
          disabled={deshabilitada}
          value={fecha}
          onChange={(valor) => {
            setFecha(valor)
            if (valor) onGuardar({ fechaFicha: valor })
          }}
        />
        <GlassField
          label="Fecha / hora inicio *"
          required
          type="datetime-local"
          disabled={deshabilitada}
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          onBlur={() => {
            if (inicio)
              onGuardar({ fechaHoraInicio: new Date(inicio).toISOString() })
          }}
        />
        <GlassField
          label="Fecha / hora fin (opcional)"
          type="datetime-local"
          disabled={deshabilitada}
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          onBlur={() => {
            if (fin) onGuardar({ fechaHoraFin: new Date(fin).toISOString() })
          }}
        />
      </div>
    </div>
  )
}
