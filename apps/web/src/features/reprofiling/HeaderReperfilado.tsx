import { GlassField } from '../../components/GlassField'
import { useSyncedState } from '../../hooks/useSyncedState'
import { aFechaCorta, fechaHoraHoyLocal } from '../new-measurement/fecha'
import { useReferenciaFicha } from '../new-measurement/queries'
import type { CambiosFicha, FichaMedicion } from '../new-measurement/types'
import { BotonFechaHoy } from '../new-measurement/components/BotonFechaHoy'

export function HeaderReperfilado({
  ficha,
  onGuardar,
  deshabilitada = false,
}: {
  ficha: FichaMedicion
  onGuardar: (cambios: CambiosFicha) => void
  deshabilitada?: boolean
}) {
  const [tren, setTren] = useSyncedState(String(ficha.trenNumero))
  const [km, setKm] = useSyncedState(String(ficha.kilometraje))
  const [pt, setPt] = useSyncedState(ficha.puestoTrabajo ?? '')
  const [inicio, setInicio] = useSyncedState(
    ficha.fechaHoraInicio?.slice(0, 16) ?? '',
  )
  const [fin, setFin] = useSyncedState(ficha.fechaHoraFin?.slice(0, 16) ?? '')
  const referenciaQuery = useReferenciaFicha(ficha.trenNumero, 'ultima_medicion')
  // Narrowing manual con 'fecha' in ...: mismo patrón que NuevasMediciones.tsx
  // (useReferenciaFicha es genérico en TipoReferencia, TS no liga el tipo de
  // retorno al valor literal 'ultima_medicion' pasado arriba).
  const referencia =
    referenciaQuery.data?.disponible && 'fecha' in referenciaQuery.data
      ? referenciaQuery.data
      : undefined
  const fechaReferencia = referencia?.fecha ? aFechaCorta(referencia.fecha) : null
  const finAntesDeInicio = Boolean(inicio && fin && fin < inicio)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        {referencia && (
          <p className="shrink-0 whitespace-nowrap font-body text-[0.6875rem] font-medium leading-snug text-concreto">
            Última registrada: {fechaReferencia ?? '—'} · {referencia.kilometraje} km
          </p>
        )}
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
        <div>
          <label
            htmlFor="reperfilado-fecha-hora-inicio"
            className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
          >
            Fecha / hora inicio *
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="reperfilado-fecha-hora-inicio"
              type="datetime-local"
              required
              disabled={deshabilitada}
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              onBlur={() => {
                if (inicio)
                  onGuardar({ fechaHoraInicio: new Date(inicio).toISOString() })
              }}
              className="glass-field w-full min-w-0 px-3 py-2 text-sm"
            />
            <BotonFechaHoy
              disabled={deshabilitada}
              onClick={() => {
                const valor = fechaHoraHoyLocal()
                setInicio(valor)
                onGuardar({ fechaHoraInicio: new Date(valor).toISOString() })
              }}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="reperfilado-fecha-hora-fin"
            className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-[0.1em] text-concreto"
          >
            Fecha / hora fin *
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="reperfilado-fecha-hora-fin"
              type="datetime-local"
              required
              disabled={deshabilitada}
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              onBlur={() => {
                if (fin) onGuardar({ fechaHoraFin: new Date(fin).toISOString() })
              }}
              className={`glass-field w-full min-w-0 px-3 py-2 text-sm ${
                finAntesDeInicio ? 'border-[color:var(--color-estado-critico)]' : ''
              }`}
            />
            <BotonFechaHoy
              disabled={deshabilitada}
              onClick={() => {
                const valor = fechaHoraHoyLocal()
                setFin(valor)
                onGuardar({ fechaHoraFin: new Date(valor).toISOString() })
              }}
            />
          </div>
          {finAntesDeInicio && (
            <p className="mt-1 font-body text-xs text-[color:var(--color-estado-critico)]">
              ⚠ La fecha/hora fin no puede ser anterior a la de inicio.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
