import type { InventoryRow } from '../types'
import { ETIQUETA_STAGE } from '../types'

const CLASE_CHIP_ESTADO: Record<string, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

const CLASE_CHIP_STAGE: Record<InventoryRow['stage'], string> = {
  almacen: 'tabla-chip--ok',
  taller: 'tabla-chip--seguimiento',
  en_servicio: 'tabla-chip--cambio',
}

function numero(v: number | null): string {
  return v === null ? '—' : v.toFixed(2)
}

export function TablaInventario({ rows, cargando }: { rows: InventoryRow[]; cargando: boolean }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[64rem] table-fixed border-collapse font-body text-xs">
        <thead className="sticky top-0 z-10 bg-[color:var(--color-arena-suave)]">
          <tr className="border-b border-concreto/20">
            <th className="px-3 py-2.5 text-left">Serie</th>
            <th className="px-2 py-2.5 text-right">T</th>
            <th className="px-2 py-2.5 text-right">H</th>
            <th className="px-2 py-2.5 text-right">Rd</th>
            <th className="px-2 py-2.5 text-center">Estado</th>
            <th className="px-2 py-2.5 text-center">Fase</th>
            <th className="px-3 py-2.5 text-left">Marca de rueda</th>
            <th className="px-3 py-2.5 text-left">Fabricante</th>
            <th className="px-3 py-2.5 text-left">Asociación</th>
            <th className="px-3 py-2.5 text-left">Último movimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="tabla-fila--glass border-b border-concreto/10">
              <td className="px-3 py-2 font-semibold text-concreto-oscuro">{r.serie ?? '—'}</td>
              <td className="px-2 py-2 text-right font-data">{numero(r.tValue)}</td>
              <td className="px-2 py-2 text-right font-data">{numero(r.hValue)}</td>
              <td className="px-2 py-2 text-right font-data">{numero(r.rdValue)}</td>
              <td className="px-2 py-2 text-center">
                {r.estadoCalculado ? (
                  <span className={`tabla-chip ${CLASE_CHIP_ESTADO[r.estadoCalculado]}`}>{r.estadoCalculado}</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-2 py-2 text-center">
                <span className={`tabla-chip ${CLASE_CHIP_STAGE[r.stage]}`}>{ETIQUETA_STAGE[r.stage]}</span>
                <span className="mt-1 block text-[0.65rem] text-concreto">{r.fase}</span>
              </td>
              <td className="px-3 py-2">{r.marcaRueda ?? '—'}</td>
              <td className="px-3 py-2">{r.fabricante ?? '—'}</td>
              <td className="px-3 py-2">{r.asociacion}</td>
              <td className="px-3 py-2">
                {r.ultimoMovimiento ? (
                  <span>
                    {r.ultimoMovimiento.tipo === 'retiro_masivo' ? 'Retiro masivo' : 'Cambio de disco'} ·{' '}
                    {r.ultimoMovimiento.fecha} · {r.ultimoMovimiento.encargadoNombre}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
          {!cargando && rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-10 text-center text-concreto">
                No hay piezas para los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
