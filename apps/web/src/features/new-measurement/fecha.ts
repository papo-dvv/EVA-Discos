// El backend expone la mayoría de fechas de la ficha (fechaFicha, fechas de
// técnicos/instrumentos/firmas) tal cual las devuelve Prisma para un campo
// @db.Date — un ISO datetime completo ("2026-08-10T00:00:00.000Z"), NO ya
// recortado a 'YYYY-MM-DD' (a diferencia de ScanRecord.fecha en aPreviewRow,
// que sí lo recorta). GlassDatePicker e <input type="date"> requieren
// exactamente 'YYYY-MM-DD' — de ahí este helper compartido por todos los
// campos de fecha de la ficha.
export function aFechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// 'YYYY-MM-DD' de hoy en huso horario local — usado por el botón "usar fecha
// de hoy" de los campos de fecha de técnicos/Ing.-Especialista/Responsable de
// Mantenimiento (FooterFicha.tsx). NO usar toISOString() acá: convierte a UTC
// primero, lo que puede devolver el día equivocado según la hora local.
export function fechaHoyCorta(): string {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

// 'YYYY-MM-DDTHH:mm' de ahora en huso horario local — mismo criterio que
// fechaHoyCorta (NO usar toISOString() directo: convierte a UTC primero),
// pero con minutos para los campos <input type="datetime-local"> de
// Reperfilado (fecha/hora inicio y fin).
export function fechaHoraHoyLocal(): string {
  const ahora = new Date()
  ahora.setSeconds(0, 0)
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset())
  return ahora.toISOString().slice(0, 16)
}
