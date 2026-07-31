// Espejo de apps/api/src/notifications (solo lectura: GET /notifications).
// Alcance mínimo acordado: sin marcar-leída ni conteo de no leídas todavía
// (ver CampanitaNotificaciones) — leido no viaja porque nada lo usa aún.
export type TipoNotificacion =
  | 'disco_critico'
  | 'solicitud_registro_pendiente'
  | 'outlier_detectado'
  | 'evento_calendario_proximo'
  | 'password_temporal_generada'
  | 'consenso_extremo_ajustado'

export type SeveridadNotificacion = 'info' | 'advertencia' | 'critico'

export interface Notificacion {
  id: string
  tipo: TipoNotificacion
  severidad: SeveridadNotificacion
  mensaje: string
  createdAt: string
}
