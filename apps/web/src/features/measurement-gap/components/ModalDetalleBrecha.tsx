import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import type { FilaAlertaMeasurementGap } from '../types'

type Props = {
  titulo: string
  discos: FilaAlertaMeasurementGap[]
  onCerrar: () => void
}

// Ventana flotante de solo lectura (GlassModal directo, mismo criterio que
// ModalDetalleFlota) con los discos de UNA categoría (alerta o severa) — el
// padre (TarjetaBrechaFechas) ya filtró la lista, este modal solo la pinta.
export function ModalDetalleBrecha({ titulo, discos, onCerrar }: Props) {
  return (
    <GlassModal titulo={`Brecha de fechas — ${titulo}`} onCerrar={onCerrar} ancho={680}>
      <p className="font-body text-sm text-concreto-oscuro">
        <span className="font-data">{discos.length}</span> disco(s) en esta categoría.
      </p>

      <div className="mt-3">
        {discos.length === 0 ? (
          <p className="py-6 text-center font-body text-sm text-concreto">Sin discos en esta categoría.</p>
        ) : (
          <ScrollArea viewportClassName="max-h-[22rem]" className="-mr-1 pr-1">
            <table className="w-full border-collapse text-left font-body text-[0.8125rem]">
              <thead>
                <tr className="border-b border-concreto/20 text-xs font-semibold uppercase tracking-wide text-concreto">
                  <th className="px-2 py-2">Tren</th>
                  <th className="px-2 py-2">Coche</th>
                  <th className="px-2 py-2">N° Coche</th>
                  <th className="px-2 py-2">Bogie</th>
                  <th className="px-2 py-2 text-right">Eje</th>
                  <th className="px-2 py-2">Lado</th>
                  <th className="px-2 py-2">Última medición</th>
                  <th className="px-2 py-2 text-right">Meses sin medir</th>
                </tr>
              </thead>
              <tbody>
                {discos.map((d, i) => (
                  <tr key={i} className="border-b border-concreto/10">
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{d.tren}</td>
                    <td className="px-2 py-1.5 text-concreto-oscuro">{d.coche}</td>
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{d.numeroCoche}</td>
                    <td className="px-2 py-1.5 text-concreto-oscuro">{d.bogie}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">{d.eje}</td>
                    <td className="px-2 py-1.5 capitalize text-concreto-oscuro">{d.lado}</td>
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{d.fechaUltimaMedicion}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
                      {d.mesesSinMedir}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <GlassButton type="button" variante="secundario" onClick={onCerrar} className="px-5 py-2.5 text-xs">
          Cerrar
        </GlassButton>
      </div>
    </GlassModal>
  )
}
