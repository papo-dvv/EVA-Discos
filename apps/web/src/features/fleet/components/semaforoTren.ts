import { AlertTriangle, CheckCircle2, Eye, RefreshCw, XCircle, type LucideIcon } from 'lucide-react'
import type { EstadoDisco } from '../../scan-records/types'
import type { FleetSummaryItem } from '../types'

// Estado dominante del tren = peor disco gana (mismo criterio que
// Dashboard/Proyecciones). Orden de severidad, alineado con el tipo
// AccionRecomendada del backend (CRITICO > CAMBIO > REPERFILADO > NINGUNA):
// un disco en reperfilado sigue pidiendo atención aunque su Rd ya lea OK.
export function getEstadoDominanteTren(conteoEstado: FleetSummaryItem['conteoEstado']): EstadoDisco {
  if (conteoEstado.critico > 0) return 'CRITICO'
  if (conteoEstado.cambio > 0) return 'CAMBIO'
  if (conteoEstado.reperfilado > 0) return 'REPERFILADO'
  if (conteoEstado.seguimiento > 0) return 'SEGUIMIENTO'
  return 'OK'
}

export const ICONO_ESTADO_TREN: Record<EstadoDisco, LucideIcon> = {
  OK: CheckCircle2,
  SEGUIMIENTO: Eye,
  CAMBIO: AlertTriangle,
  CRITICO: XCircle,
  REPERFILADO: RefreshCw,
}
