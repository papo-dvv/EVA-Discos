import { CardFormulas } from '../../../components/CardFormulas'
import { Widget } from '../../../components/Widget'
import { PanelParametros } from '../../system-params/components/PanelParametros'
import type { ConteoPorEstado, StatsScanRecords } from '../types'

type EstadoTarjeta = 'ok' | 'seguimiento' | 'cambio' | 'critico' | 'reperfilado'

const TARJETAS: { estado: EstadoTarjeta; label: string; key: keyof ConteoPorEstado }[] = [
  { estado: 'ok', label: 'OK', key: 'ok' },
  { estado: 'seguimiento', label: 'Seguimiento', key: 'seguimiento' },
  { estado: 'cambio', label: 'Cambio', key: 'cambio' },
  { estado: 'critico', label: 'Crítico', key: 'critico' },
  { estado: 'reperfilado', label: 'Reperfilado', key: 'reperfilado' },
]

// Panel lateral: 5 tarjetas de estado (total vs. mostrando) + parámetros
// editables inline con confirmación previa al PATCH. Compartido entre la
// vista previa de una migración en curso y la vista permanente de
// confirmados — `etiquetaTotal` es lo único que cambia entre modos (el texto
// no tiene sentido decir "de esta carga" cuando no hay ninguna carga de por medio).
export function PanelEstados({
  stats,
  hayFiltro,
  etiquetaTotal = 'filas en esta carga',
}: {
  stats?: StatsScanRecords
  hayFiltro: boolean
  etiquetaTotal?: string
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Widget
          tamano="s"
          etiqueta="Total de datos"
          valor={stats?.totalFilasSubidas ?? 0}
          pie={<span className="font-body text-xs text-concreto">{etiquetaTotal}</span>}
          className="col-span-2"
        />
        {TARJETAS.map((t) => {
          const total = stats?.total[t.key] ?? 0
          const mostrando = stats?.filtrado[t.key] ?? 0
          return (
            <Widget
              key={t.estado}
              tamano="s"
              estado={t.estado}
              etiqueta={t.label}
              valor={mostrando}
              // Reperfilado es la excepción entre las 4 tarjetas normales de
              // Rd puro: ocupa el ancho completo en su propia fila para
              // destacarlo como el caso especial que es (H manda sobre Rd).
              className={t.estado === 'reperfilado' ? 'col-span-2' : undefined}
              pie={
                <span className="font-body text-xs text-concreto">
                  {hayFiltro ? (
                    <>
                      mostrando <span className="font-data">{mostrando}</span> · total{' '}
                      <span className="font-data">{total}</span>
                    </>
                  ) : (
                    <>
                      total <span className="font-data">{total}</span>
                    </>
                  )}
                </span>
              }
            />
          )
        })}
      </div>

      <CardFormulas variante="mediciones" />
      <PanelParametros modulo="mediciones" />
    </div>
  )
}
