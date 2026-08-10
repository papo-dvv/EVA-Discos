import { RefreshCw } from 'lucide-react'
import { GlassButton } from '../../../components/GlassButton'
import { WarningTooltip } from '../../../components/WarningTooltip'
import { useUltimoSnapshot } from '../queries'
import type { ModuloSnapshot } from '../types'

function formatearFechaExacta(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

type Props = {
  modulo: ModuloSnapshot
}

// Botón "Actualizar datos del módulo" + fecha del último snapshot (ver
// GenerarSnapshotService/GET /module-snapshot/last en el backend).
// DESHABILITADO a propósito: todavía no existe el módulo de registro de
// nuevas mediciones, así que "actualizar" no tendría datos distintos que
// recalcular — este componente es puramente visual y de consulta de fecha,
// sin ninguna lógica de refetch/recálculo todavía (eso llega en un prompt
// aparte cuando ese módulo exista). Reutilizado tal cual en Trazabilidad y
// Proyección, un solo lugar en vez de duplicar este bloque en cada pantalla.
export function EstadoActualizacionModulo({ modulo }: Props) {
  const ultimo = useUltimoSnapshot(modulo)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <WarningTooltip texto="Disponible cuando el módulo de registro de nuevas mediciones esté implementado.">
        <GlassButton type="button" variante="secundario" disabled className="gap-2">
          <RefreshCw size={14} strokeWidth={2.25} />
          Actualizar datos del módulo
        </GlassButton>
      </WarningTooltip>
      <p className="font-body text-xs text-concreto">
        Última actualización:{' '}
        <span className="font-data text-concreto-oscuro">
          {ultimo.isLoading ? 'Cargando…' : ultimo.data ? formatearFechaExacta(ultimo.data.generadoEn) : 'Sin datos todavía'}
        </span>
      </p>
    </div>
  )
}
