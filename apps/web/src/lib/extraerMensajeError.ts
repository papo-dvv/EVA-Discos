import { isAxiosError } from 'axios'

// El backend (ValidationPipe / excepciones de Nest) responde { message, error, statusCode }
// donde message puede ser un string (excepciones de negocio) o un string[] (class-validator).
// Algunas excepciones de negocio (ej. Regla A del consenso de percentiles,
// ver ConsensoValidationService) además adjuntan `combinaciones` con el
// detalle de qué scope la causó — si vienen, se agregan al mensaje tal cual
// las devuelve el backend, nunca recalculadas en el cliente.
export function extraerMensajeError(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; combinaciones?: { scope: string; amplitud: number }[] }
      | undefined
    const partes: string[] = []
    if (Array.isArray(data?.message)) partes.push(data.message.join(' '))
    else if (typeof data?.message === 'string') partes.push(data.message)

    if (data?.combinaciones && data.combinaciones.length > 0) {
      const detalle = data.combinaciones
        .map((c) => `${c.scope} (amplitud ${c.amplitud.toFixed(3)})`)
        .join('; ')
      partes.push(`Combinaciones afectadas: ${detalle}.`)
    }

    if (partes.length > 0) return partes.join(' ')
  }
  return fallback
}
