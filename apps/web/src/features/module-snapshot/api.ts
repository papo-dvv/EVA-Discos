import { apiClient } from '../../lib/apiClient'
import type { ModuloSnapshot, ModuleSnapshotResponse } from './types'

// null cuando todavía no se generó ningún snapshot de ese módulo (ver
// GenerarSnapshotService.obtenerUltimo en el backend).
export async function obtenerUltimoSnapshot(modulo: ModuloSnapshot): Promise<ModuleSnapshotResponse | null> {
  const { data } = await apiClient.get<ModuleSnapshotResponse | null>('/module-snapshot/last', {
    params: { modulo },
  })
  return data
}
