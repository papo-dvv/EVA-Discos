import { GlassButton } from '../../../components/GlassButton'
import { GlassModal } from '../../../components/GlassModal'
import { ScrollArea } from '../../../components/ScrollArea'
import { useDetallePronostico } from '../queries'
import type { TipoEventoPronostico } from '../types'

type Props = {
  tren: number | undefined
  periodo: string
  tipo?: TipoEventoPronostico
  onCerrar: () => void
}

function etiquetaPeriodo(periodo: string): string {
  if (/^\d{4}$/.test(periodo)) return periodo
  const [anio, mes] = periodo.split('-').map(Number)
  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' })
    .format(new Date(anio, mes - 1, 1))
    .replace(/^./, (letra) => letra.toUpperCase())
}

function etiquetaTipo(tipo?: TipoEventoPronostico): string {
  if (tipo === 'CAMBIO') return 'Cambios'
  if (tipo === 'REPERFILADO') return 'Reperfilados'
  return 'Eventos'
}

export function ModalDetallePronostico({ tren, periodo, tipo, onCerrar }: Props) {
  const detalle = useDetallePronostico(tren, periodo, tipo)

  return (
    <GlassModal
      titulo={`${etiquetaTipo(tipo)} proyectados — ${etiquetaPeriodo(periodo)}`}
      onCerrar={onCerrar}
      ancho={920}
    >
      <p className="font-body text-sm text-concreto-oscuro">
        Fechas estimadas y ubicación física de cada eje, con ambos lados cuando corresponde.
      </p>

      <div className="mt-3">
        {detalle.isLoading ? (
          <p className="py-8 text-center font-body text-sm text-concreto">Cargando detalle…</p>
        ) : detalle.isError ? (
          <p role="alert" className="py-8 text-center font-body text-sm text-[color:var(--color-estado-critico)]">
            No se pudo cargar el detalle del pronóstico.
          </p>
        ) : !detalle.data || detalle.data.length === 0 ? (
          <p className="py-8 text-center font-body text-sm text-concreto">Sin eventos proyectados en este período.</p>
        ) : (
          <ScrollArea ejes="both" viewportClassName="max-h-[24rem]" className="-mr-1 pr-1">
            <table className="w-full min-w-[48rem] border-collapse text-left font-body text-[0.8125rem]">
              <thead>
                <tr className="border-b border-concreto/20 text-xs font-semibold uppercase tracking-wide text-concreto">
                  <th className="px-2 py-2">Última medición</th>
                  <th className="px-2 py-2 text-right">Días hasta evento</th>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Tren</th>
                  <th className="px-2 py-2">Coche</th>
                  <th className="px-2 py-2 text-right">N° coche</th>
                  <th className="px-2 py-2">Bogie</th>
                  <th className="px-2 py-2 text-right">Eje</th>
                  <th className="px-2 py-2">Lado</th>
                </tr>
              </thead>
              <tbody>
                {detalle.data.map((evento, indice) => (
                  <tr
                    key={`${evento.fechaEstimada}-${evento.tipo}-${evento.trenNumero}-${indice}`}
                    className="border-b border-concreto/10"
                  >
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{evento.fechaUltimaMedicion}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">{evento.diasHastaEvento}</td>
                    <td className="px-2 py-1.5 font-data text-concreto-oscuro">{evento.fechaEstimada}</td>
                    <td className="px-2 py-1.5 font-semibold text-concreto-oscuro">
                      {evento.tipo === 'CAMBIO' ? 'Cambio' : 'Reperfilado'}
                      {evento.pendiente && <span className="ml-1 text-[color:var(--color-estado-seguimiento)]">pendiente</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">{evento.trenNumero}</td>
                    <td className="px-2 py-1.5 text-concreto-oscuro">{evento.posiciones[0]?.tipoCoche}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
                      {evento.posiciones[0]?.numeroCoche}
                    </td>
                    <td className="px-2 py-1.5 text-concreto-oscuro">{evento.posiciones[0]?.bogieCodigo}</td>
                    <td className="px-2 py-1.5 text-right font-data text-concreto-oscuro">
                      {evento.posiciones[0]?.ejeNumero}
                    </td>
                    <td className="px-2 py-1.5 capitalize text-concreto-oscuro">
                      {evento.posiciones.map((posicion) => posicion.lado).join(' / ')}
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
