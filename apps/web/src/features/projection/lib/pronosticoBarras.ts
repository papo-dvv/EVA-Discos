import type { PronosticoMes } from '../types'

export type VistaBarras = 'anio' | 'mes'

export type DatoBarra = {
  periodo: string
  etiqueta: string
  reperfilados: number
  cambios: number
  criticos: number
}

export function datosMensuales(meses: PronosticoMes[], anio: number): DatoBarra[] {
  return meses
    .filter((mes) => mes.mes.startsWith(String(anio)))
    .map((mes) => ({
      periodo: mes.mes,
      etiqueta: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(
        new Date(anio, Number(mes.mes.slice(5, 7)) - 1, 1),
      ),
      reperfilados: mes.reperfilados,
      cambios: mes.cambios,
      criticos: mes.desgloseEstado.critico,
    }))
}
