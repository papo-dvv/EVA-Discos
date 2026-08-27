import { ChevronDown, ChevronUp, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassSurface } from '../../../components/GlassSurface'
import { ESTADO_META } from '../../fleet/components/estadoVisual'
import { getEstadoDominanteTren, ICONO_ESTADO_TREN } from '../../fleet/components/semaforoTren'
import type { FleetSummaryItem } from '../../fleet/types'
import type { EstadoDisco } from '../../scan-records/types'
import { useProyeccionDiscos } from '../queries'
import type { FilaProyeccion } from '../types'

const CLASE_CHIP_ESTADO: Record<EstadoDisco, string> = {
  OK: 'tabla-chip--ok',
  SEGUIMIENTO: 'tabla-chip--seguimiento',
  CAMBIO: 'tabla-chip--cambio',
  CRITICO: 'tabla-chip--critico',
  REPERFILADO: 'tabla-chip--reperfilado',
}

function EstadoChip({ estado }: { readonly estado: EstadoDisco }) {
  return <span className={`tabla-chip ${CLASE_CHIP_ESTADO[estado]}`}>{estado}</span>
}

function claveCoche(fila: FilaProyeccion): string {
  return `${fila.posicion.tipoCoche}-${fila.posicion.numeroCoche}`
}

function fechaEstimada(fila: FilaProyeccion): string {
  return fila.cicloCambio?.fechaEstimada ?? fila.ciclosReperfilado[0]?.fechaEstimada ?? '—'
}

function TrenCriticoDetalle({ trenNumero }: { readonly trenNumero: number }) {
  const navigate = useNavigate()
  const discos = useProyeccionDiscos({ tren: trenNumero, page: 1, pageSize: 200, estado: ['CRITICO', 'CAMBIO'] })

  const grupos = useMemo(() => {
    const rows = discos.data?.rows ?? []
    const mapa = new Map<string, { tipoCoche: string; numeroCoche: number; discos: FilaProyeccion[] }>()
    for (const fila of rows) {
      const clave = claveCoche(fila)
      const grupo = mapa.get(clave) ?? { tipoCoche: fila.posicion.tipoCoche, numeroCoche: fila.posicion.numeroCoche, discos: [] }
      grupo.discos.push(fila)
      mapa.set(clave, grupo)
    }
    return [...mapa.values()].sort((a, b) => a.numeroCoche - b.numeroCoche)
  }, [discos.data])

  if (discos.isLoading) return <p className="mt-3 font-body text-sm text-concreto">Cargando…</p>
  if (grupos.length === 0) return <p className="mt-3 font-body text-sm text-concreto">Sin discos críticos o en cambio.</p>

  return (
    <div className="mt-3 space-y-3">
      {grupos.map((grupo) => (
        <div key={`${grupo.tipoCoche}-${grupo.numeroCoche}`} className="rounded-xl border border-concreto/20 bg-white/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.08em] text-concreto-oscuro">
              {grupo.tipoCoche} {grupo.numeroCoche}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/operaciones?tren=${trenNumero}&coche=${grupo.numeroCoche}`)}
              className="inline-flex items-center gap-1.5 rounded-full bg-verde-institucional px-3 py-1 font-body text-xs font-semibold text-white transition-colors hover:bg-verde-institucional/85"
            >
              <Wrench size={12} aria-hidden /> Operar
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {grupo.discos.map((fila) => (
              <li key={fila.discId} className="flex flex-wrap items-center justify-between gap-2 font-body text-xs text-concreto">
                <span>
                  Bogie {fila.posicion.bogieCodigo} · Eje {fila.posicion.ejeNumero} ·{' '}
                  {fila.posicion.lado === 'izquierdo' ? 'Izquierdo' : 'Derecho'}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-data text-concreto-oscuro">{fechaEstimada(fila)}</span>
                  <EstadoChip estado={fila.estado} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

type Props = {
  readonly item: FleetSummaryItem
}

// Card expandible por tren (tren→coche→disco), réplica adaptada de
// TrenCriticoCard.tsx de EVA-Aldy — acá el nivel de urgencia es directamente
// el estado dominante ya calculado por getEstadoDominanteTren (EVA tiene 5
// estados reales, no franjas de semanas inventadas). Sin "cambios
// pospuestos": EVA no tiene ese concepto.
export function TrenCriticoCardProyeccion({ item }: Props) {
  const [expandido, setExpandido] = useState(false)
  const estado = getEstadoDominanteTren(item.conteoEstado)
  const meta = ESTADO_META[estado]
  const Icono = ICONO_ESTADO_TREN[estado]

  return (
    <GlassSurface fuerte className="rounded-glass border-l-4 p-4" style={{ borderLeftColor: meta.cssVar }}>
      <button type="button" onClick={() => setExpandido((e) => !e)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: `color-mix(in srgb, ${meta.cssVar} 15%, transparent)` }}
          >
            <Icono size={17} style={{ color: meta.cssVar }} aria-hidden />
          </span>
          <span>
            <p className="font-display text-sm font-semibold text-concreto-oscuro">Tren {item.tren}</p>
            <p className="font-body text-xs text-concreto">
              {item.conteoEstado.critico} críticos · {item.conteoEstado.cambio} en cambio
            </p>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`tabla-chip ${meta.chipClass}`}>{meta.etiqueta}</span>
          {expandido ? <ChevronUp size={16} className="text-concreto" /> : <ChevronDown size={16} className="text-concreto" />}
        </span>
      </button>

      {expandido && <TrenCriticoDetalle trenNumero={item.tren} />}
    </GlassSurface>
  )
}
