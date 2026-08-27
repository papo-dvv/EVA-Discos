import { useState } from 'react'
import { ArrowRight, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassModal } from '../../../components/GlassModal'
import { GlassSurface } from '../../../components/GlassSurface'
import { guardarFichaActiva } from '../../new-measurement/fichaActiva'
import { CargaInicialReperfilado } from '../../reprofiling/CargaInicialReperfilado'
import { useTrenesPendientesReperfilado } from '../queries'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

// Tarjeta modal de "Reperfilado pendiente" (Operaciones): lista los trenes
// con al menos un disco cuya medición confirmada más reciente clasifica como
// REPERFILADO (ver FleetService.pendientesReperfilado) y, al elegir uno,
// pasa al mismo paso de "Tomar foto / Llenar manualmente" que ya usa el
// flujo de reperfilado — con el tren ya preseleccionado (ver
// CargaInicialReperfilado.trenInicial).
export function ModalPendientesReperfilado({ onCerrar }: { onCerrar: () => void }) {
  const pendientes = useTrenesPendientesReperfilado()
  const [trenSeleccionado, setTrenSeleccionado] = useState<number | null>(null)
  const navigate = useNavigate()

  if (trenSeleccionado !== null) {
    return (
      <GlassModal titulo={`Nuevo reperfilado — Tren ${trenSeleccionado}`} onCerrar={onCerrar} ancho={560}>
        <CargaInicialReperfilado
          trenInicial={trenSeleccionado}
          onCreada={(fichaId) => {
            guardarFichaActiva('reperfilado', fichaId)
            onCerrar()
            navigate(`/nuevas-mediciones/${fichaId}`)
          }}
        />
      </GlassModal>
    )
  }

  return (
    <GlassModal titulo="Reperfilado pendiente" onCerrar={onCerrar} ancho={560} altoMaximo="80vh">
      <p className="mb-4 shrink-0 font-body text-sm text-concreto">
        Trenes con al menos un disco que califica para reperfilado según su última medición confirmada.
      </p>

      {pendientes.isLoading && <p className="font-body text-sm text-concreto">Cargando trenes…</p>}
      {pendientes.isError && (
        <p role="alert" className="font-body text-sm text-[color:var(--color-estado-critico)]">
          No se pudo cargar la lista de trenes pendientes.
        </p>
      )}
      {pendientes.data && pendientes.data.length === 0 && (
        <p className="font-body text-sm text-concreto">Ningún tren tiene reperfilado pendiente ahora mismo.</p>
      )}

      {pendientes.data && pendientes.data.length > 0 && (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {pendientes.data.map((tren) => (
            <button
              key={tren.tren}
              type="button"
              onClick={() => setTrenSeleccionado(tren.tren)}
              className="block w-full text-left"
            >
              <GlassSurface elevar className="flex items-center justify-between gap-3 rounded-glass px-4 py-3 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-verde-institucional to-verde-institucional/70 text-white">
                    <RefreshCcw size={16} aria-hidden />
                  </span>
                  <div>
                    <p className="font-data text-base font-bold text-concreto-oscuro">T{tren.tren}</p>
                    <p className="font-body text-xs text-concreto">
                      {tren.discosReperfilado} disco(s) · última medición {formatearFecha(tren.fechaUltimaMedicion)}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} aria-hidden className="text-concreto" />
              </GlassSurface>
            </button>
          ))}
        </div>
      )}
    </GlassModal>
  )
}
