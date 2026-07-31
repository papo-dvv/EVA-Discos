import { GlassSurface } from '../../../components/GlassSurface'

type Props = {
  conteo: number
}

// Estado vacío explícito cuando el scope elegido tiene menos de 20 pares
// válidos — el backend ni siquiera calcula límites en ese caso (ver
// TraceabilityService, CONTEO_MINIMO), así que acá tampoco se intenta
// renderizar gráfico/paneles con datos a medias.
export function EstadoDatosInsuficientes({ conteo }: Props) {
  return (
    <GlassSurface fuerte className="mt-4 rounded-glass p-10 text-center">
      <p className="font-display text-lg font-semibold text-concreto-oscuro">Datos insuficientes para este alcance</p>
      <p className="mx-auto mt-2 max-w-md font-body text-sm text-concreto">
        Se necesitan al menos 20 mediciones para calcular límites confiables en esta combinación — actualmente hay{' '}
        <span className="font-data text-concreto-oscuro">{conteo}</span>.
      </p>
      <p className="mt-3 font-body text-xs text-concreto">Probá quitar algún filtro de tren, tipo de coche o bogie.</p>
    </GlassSurface>
  )
}
