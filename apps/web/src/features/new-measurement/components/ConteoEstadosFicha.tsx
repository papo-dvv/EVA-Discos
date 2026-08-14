import { useMemo } from 'react'
import { Widget } from '../../../components/Widget'
import type { EstadoDisco, PreviewRow } from '../types'

type EstadoTarjeta = 'ok' | 'seguimiento' | 'cambio' | 'critico' | 'reperfilado'

const TARJETAS: { estado: EstadoTarjeta; etiqueta: string; clave: EstadoDisco }[] = [
  { estado: 'ok', etiqueta: 'OK', clave: 'OK' },
  { estado: 'seguimiento', etiqueta: 'Seguimiento', clave: 'SEGUIMIENTO' },
  { estado: 'cambio', etiqueta: 'Cambio', clave: 'CAMBIO' },
  { estado: 'critico', etiqueta: 'Crítico', clave: 'CRITICO' },
  { estado: 'reperfilado', etiqueta: 'Reperfilado', clave: 'REPERFILADO' },
]

// 5 cards de conteo en vivo (OK/Seguimiento/Cambio/Crítico/Reperfilado):
// cuenta cuántas filas de la tabla tienen ese estadoCalculado EN ESTE
// MOMENTO. No duplica la lógica de clasificarEstado del backend — es un
// simple tally de un campo que el backend ya calculó y devolvió en `rows`
// (mismo criterio de "backend como única fuente de verdad" del resto de la
// app) — se recalcula solo con re-renderizar, así que cualquier edición de
// H/T que invalide la query de la ficha (ver useEditarFilaFicha/
// useAgregarFilaFicha) refresca estos conteos sin ningún código extra acá.
export function ConteoEstadosFicha({ rows }: { rows: PreviewRow[] }) {
  const conteo = useMemo(() => {
    const c: Record<EstadoDisco, number> = { OK: 0, SEGUIMIENTO: 0, CAMBIO: 0, CRITICO: 0, REPERFILADO: 0 }
    for (const fila of rows) {
      if (fila.estadoCalculado) c[fila.estadoCalculado]++
    }
    return c
  }, [rows])

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {TARJETAS.map((t) => (
        <Widget key={t.estado} tamano="s" estado={t.estado} etiqueta={t.etiqueta} valor={conteo[t.clave]} />
      ))}
    </div>
  )
}
