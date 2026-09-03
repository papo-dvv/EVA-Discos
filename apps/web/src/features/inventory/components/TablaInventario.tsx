import { Eye, Pencil, Trash2 } from 'lucide-react'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { ETIQUETA_FABRICANTE, type Fabricante, type InventoryRow, type InventoryStage } from '../types'

const CLASE_CHIP_ESTADO: Record<string, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

const CLASE_CHIP_FASE: Record<string, string> = {
  nueva: 'tabla-chip--ok',
  usada: 'tabla-chip--seguimiento',
}

function numero(v: number | null): string {
  return v === null ? '—' : v.toFixed(2)
}

function celdaNumero(v: number | null, esSupuesto: boolean) {
  return <span className={esSupuesto ? 'italic opacity-60' : undefined}>{numero(v)}</span>
}

function hCentral(row: InventoryRow) {
  const izquierda = row.izquierdo?.hValue ?? null
  const derecha = row.derecho?.hValue ?? null
  const valor = izquierda === null
    ? numero(derecha)
    : derecha === null || izquierda === derecha
      ? numero(izquierda)
      : `${numero(izquierda)} | ${numero(derecha)}`
  const esSupuesto = Boolean(row.izquierdo?.esSupuesto || row.derecho?.esSupuesto)
  return <span className={esSupuesto ? 'italic opacity-60' : undefined}>{valor}</span>
}

function EstadoChip({ estado, esSupuesto }: { estado: string | null; esSupuesto?: boolean }) {
  if (!estado) return <span>—</span>
  const chip = <span className={`tabla-chip tabla-chip--pequeno ${CLASE_CHIP_ESTADO[estado]} ${esSupuesto ? 'opacity-60' : ''}`}>{estado}</span>
  if (!esSupuesto) return chip
  return (
    <span className="inline-flex items-center gap-1">
      {chip}
      <WarningTooltip texto="Disco nuevo sin medir todavía — valor de fábrica (T: 7.00 / H: 0), no una medición real.">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-concreto/30 text-[0.5rem] font-bold text-concreto">?</span>
      </WarningTooltip>
    </span>
  )
}

// Extra columnas por stage — mismo criterio para las 3 tablas de Inventario
// (Serie + Disco L/R + Acciones son fijas siempre, ver comentario del
// usuario en el pedido original): Taller trae Marca/Lote (identidad de
// pieza suelta) + Asociación; En Servicio cambia Marca/Lote por Posición
// (está montada, ya no aplica "marca/lote de almacén" como dato principal);
// Almacén es la más chica — sin fase/asociación (una pieza en almacén
// siempre es una sola cosa: stock disponible, no hace falta explicarlo fila
// por fila) y sin marca (Lote alcanza para identificar el lote de compra).
type ColumnaExtra = 'fase' | 'marca' | 'lote' | 'fabricante' | 'posicion' | 'asociacion' | 'movimiento'

const COLUMNAS_EXTRA: Record<InventoryStage, ColumnaExtra[]> = {
  taller: ['fase', 'marca', 'lote', 'fabricante', 'asociacion', 'movimiento'],
  en_servicio: ['fase', 'posicion', 'fabricante', 'asociacion', 'movimiento'],
  almacen: ['lote', 'fabricante', 'movimiento'],
}

const ETIQUETA_COLUMNA: Record<ColumnaExtra, string> = {
  fase: 'Fase',
  marca: 'Marca de disco',
  lote: 'Lote',
  fabricante: 'Fabricante',
  posicion: 'Posición',
  asociacion: 'Asociación',
  movimiento: 'Último movimiento',
}

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  retiro_masivo: 'Retiro masivo',
  cambio_disco: 'Cambio de disco',
  devolucion_almacen: 'Devolución a almacén',
}

function celdaExtra(row: InventoryRow, columna: ColumnaExtra) {
  switch (columna) {
    case 'fase':
      return <span className={`tabla-chip tabla-chip--pequeno ${CLASE_CHIP_FASE[row.fase]}`}>{row.fase}</span>
    case 'marca':
      return row.marcaRueda ?? '—'
    case 'lote':
      return row.lote ?? '—'
    case 'fabricante':
      return row.fabricante ? ETIQUETA_FABRICANTE[row.fabricante as Fabricante] : '—'
    case 'posicion':
      return row.posicion ? (
        <span className="flex items-center gap-1.5">
          Tren {row.posicion.trenNumero} · {row.posicion.modeloVagon}
          <WarningTooltip
            texto={`Coche ${row.posicion.numeroCoche} · Bogie ${row.posicion.bogieCodigo} · Eje ${row.posicion.ejeNumero}`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-concreto/30 text-[0.55rem] font-bold text-concreto">?</span>
          </WarningTooltip>
        </span>
      ) : (
        '—'
      )
    case 'asociacion':
      return row.asociacion
    case 'movimiento':
      return row.ultimoMovimiento ? (
        <span>
          {ETIQUETA_MOVIMIENTO[row.ultimoMovimiento.tipo]} · {row.ultimoMovimiento.fecha} · {row.ultimoMovimiento.encargadoNombre}
        </span>
      ) : (
        '—'
      )
  }
}

export function TablaInventario({
  stage,
  rows,
  cargando,
  seleccionables = false,
  seleccionados,
  onToggleSeleccion,
  onVerDetalle,
  onEditar,
  onEliminar,
}: {
  stage: InventoryStage
  rows: InventoryRow[]
  cargando: boolean
  seleccionables?: boolean
  seleccionados?: Set<string>
  onToggleSeleccion?: (serie: string) => void
  onVerDetalle: (row: InventoryRow) => void
  onEditar: (row: InventoryRow) => void
  onEliminar: (row: InventoryRow) => void
}) {
  const columnasExtra = COLUMNAS_EXTRA[stage]
  const totalCeldas = (seleccionables ? 1 : 0) + 1 + 7 + columnasExtra.length + 1

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[80rem] table-fixed border-collapse font-body text-xs">
        <thead className="sticky top-0 z-10 bg-[color:var(--color-arena-suave)]">
          <tr className="border-b border-concreto/10">
            {seleccionables && <th rowSpan={3} className="w-8 px-2 py-2.5" />}
            <th rowSpan={3} className="px-3 py-2.5 text-left align-bottom">Serie</th>
            <th colSpan={7} className="px-2 py-1.5 text-center border-b border-concreto/10">Disco</th>
            {columnasExtra.map((c) => (
              <th key={c} rowSpan={3} className="px-3 py-2.5 text-left align-bottom">{ETIQUETA_COLUMNA[c]}</th>
            ))}
            <th rowSpan={3} className="px-3 py-2.5 text-center align-bottom">Acciones</th>
          </tr>
          <tr className="border-b border-concreto/20">
            <th colSpan={3} className="px-1.5 py-1 text-center text-[0.65rem] uppercase tracking-[0.12em] text-concreto">Izquierda</th>
            <th rowSpan={2} className="px-1.5 py-1 text-center align-bottom text-[0.65rem] uppercase tracking-[0.12em] text-concreto">H</th>
            <th colSpan={3} className="px-1.5 py-1 text-center text-[0.65rem] uppercase tracking-[0.12em] text-concreto">Derecha</th>
          </tr>
          <tr className="border-b border-concreto/20">
            <th className="px-1.5 py-1.5 text-center">Estado</th>
            <th className="px-1.5 py-1.5 text-right">Rd</th>
            <th className="px-1.5 py-1.5 text-right">T</th>
            <th className="px-1.5 py-1.5 text-right">T</th>
            <th className="px-1.5 py-1.5 text-right">Rd</th>
            <th className="px-1.5 py-1.5 text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.clave} className="tabla-fila--glass border-b border-concreto/10">
              {seleccionables && (
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.serie ? (seleccionados?.has(r.serie) ?? false) : false}
                    disabled={!r.serie}
                    onChange={() => r.serie && onToggleSeleccion?.(r.serie)}
                    aria-label={`Seleccionar eje ${r.serie ?? ''}`}
                  />
                </td>
              )}
              <td className="px-3 py-2 font-semibold text-concreto-oscuro">{r.serie ? `${r.serie}-D` : '—'}</td>

              {/* Izquierdo: Estado, Rd, T, H */}
              <td className="px-1.5 py-2 text-center">{r.izquierdo ? <EstadoChip estado={r.izquierdo.estadoCalculado} esSupuesto={r.izquierdo.esSupuesto} /> : '—'}</td>
              <td className="px-1.5 py-2 text-right font-data">{r.izquierdo ? celdaNumero(r.izquierdo.rdValue, r.izquierdo.esSupuesto) : '—'}</td>
              <td className="px-1.5 py-2 text-right font-data">{r.izquierdo ? celdaNumero(r.izquierdo.tValue, r.izquierdo.esSupuesto) : '—'}</td>
              <td className="px-1.5 py-2 text-center font-data" title="H izquierda | H derecha">{hCentral(r)}</td>
              {/* Derecho en espejo; H compartida se muestra una sola vez al centro. */}
              <td className="px-1.5 py-2 text-right font-data">{r.derecho ? celdaNumero(r.derecho.tValue, r.derecho.esSupuesto) : '—'}</td>
              <td className="px-1.5 py-2 text-right font-data">{r.derecho ? celdaNumero(r.derecho.rdValue, r.derecho.esSupuesto) : '—'}</td>
              <td className="px-1.5 py-2 text-center">{r.derecho ? <EstadoChip estado={r.derecho.estadoCalculado} esSupuesto={r.derecho.esSupuesto} /> : '—'}</td>

              {columnasExtra.map((c) => (
                <td key={c} className="px-3 py-2">{celdaExtra(r, c)}</td>
              ))}

              <td className="px-3 py-2">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" title="Ver detalles" onClick={() => onVerDetalle(r)} className="rounded-full p-1.5 text-concreto transition-colors hover:bg-white/70 hover:text-concreto-oscuro">
                    <Eye size={14} aria-hidden />
                  </button>
                  <button type="button" title="Editar" onClick={() => onEditar(r)} className="rounded-full p-1.5 text-concreto transition-colors hover:bg-white/70 hover:text-concreto-oscuro">
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button type="button" title="Eliminar" onClick={() => onEliminar(r)} className="rounded-full p-1.5 text-[color:var(--color-estado-critico)] transition-colors hover:bg-white/70">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!cargando && rows.length === 0 && (
            <tr>
              <td colSpan={totalCeldas} className="px-3 py-10 text-center text-concreto">
                No hay ejes para los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
