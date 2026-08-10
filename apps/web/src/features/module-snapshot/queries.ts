import { useQuery } from '@tanstack/react-query'
import { obtenerUltimoSnapshot } from './api'
import type { ModuloSnapshot } from './types'

const claves = {
  ultimo: (modulo: ModuloSnapshot) => ['module-snapshot', 'last', modulo] as const,
}

export function useUltimoSnapshot(modulo: ModuloSnapshot) {
  return useQuery({
    queryKey: claves.ultimo(modulo),
    queryFn: () => obtenerUltimoSnapshot(modulo),
  })
}
