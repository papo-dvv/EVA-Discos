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
