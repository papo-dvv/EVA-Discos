import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import type { UltimaMedicionTren } from '../ultimaMedicion'

type Props = {
  tren: number
  resultado: UltimaMedicionTren
  onCerrar: () => void
}

// Ventana flotante de solo lectura (GlassModal directo) — especifica si la
// última medición del tren fue un bogie puntual o cubrió toda la flota del
// tren (ver calcularUltimaMedicionTren).
export function ModalDetalleUltimaMedicionTren({ tren, resultado, onCerrar }: Props) {
  return (
    <GlassModal titulo={`Última medición — Tren ${tren}`} onCerrar={onCerrar} ancho={560}>
      <p className="font-body text-sm text-concreto-oscuro">
        Fecha: <span className="font-data">{resultado.fecha}</span>
      </p>

      {resultado.todaLaFlota ? (
        <p className="mt-3 font-body text-sm text-concreto-oscuro">
          Los <span className="font-data">{resultado.filas.length}</span> discos con historial de este
          tren fueron medidos ese mismo día — <b>toda la flota del tren</b>, no un bogie puntual.
        </p>
      ) : (
        <>
          <p className="mt-3 font-body text-sm text-concreto-oscuro">
            Se midió específicamente:
          </p>
          <table className="mt-2 w-full border-collapse text-left font-body text-[0.8125rem]">
            <thead>
              <tr className="border-b border-concreto/20 text-xs font-semibold uppercase tracking-wide text-concreto">
                <th className="px-2 py-2">Bogie</th>
                <th className="px-2 py-2 text-right">Eje</th>
                <th className="px-2 py-2">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {resultado.filas.map((f) => (
                <tr key={f.id} className="border-b border-concreto/10">
                  <td className="px-2 py-1.5 text-concreto-oscuro">{f.bogieExcel}</td>
                  <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">{f.ejeExcel}</td>
                  <td className="px-2 py-1.5 text-concreto-oscuro">{f.ubicacionExcel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-5 flex justify-end">
        <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
          Cerrar
        </GlassButton>
      </div>
    </GlassModal>
  )
}
