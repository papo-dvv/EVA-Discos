// Tipos espejo de los enums de la base de datos (ver /schema_eva.sql y
// apps/api/prisma/schema.prisma). Viven acá para que apps/web pueda tiparlos
// sin depender de @prisma/client. Si el enum cambia en el schema de Prisma,
// se actualiza acá también — son texto plano a propósito, no se generan.

export const MODELO_TREN = ['ansaldo_mb300', 'alstom_metropolis9000'] as const
export type ModeloTren = (typeof MODELO_TREN)[number]

export const ESTADO_TREN = ['operativo', 'mantenimiento', 'baja'] as const
export type EstadoTren = (typeof ESTADO_TREN)[number]

export const TIPO_COCHE = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'] as const
export type TipoCoche = (typeof TIPO_COCHE)[number]

export const LADO_DISCO = ['izquierdo', 'derecho'] as const
export type LadoDisco = (typeof LADO_DISCO)[number]

export const ROL_USUARIO = [
  'administrador',
  'supervisor',
  'tecnico_medicion',
  'tecnico_analisis',
  'operador_almacen',
  'auditor',
  'solo_lectura',
] as const
export type RolUsuario = (typeof ROL_USUARIO)[number]

export const ESTADO_CUENTA = ['pendiente_aprobacion', 'activo', 'rechazado', 'bloqueado'] as const
export type EstadoCuenta = (typeof ESTADO_CUENTA)[number]

export const TIPO_RESET_PASSWORD = ['admin_manual', 'temporal_por_email'] as const
export type TipoResetPassword = (typeof TIPO_RESET_PASSWORD)[number]

export const ESTADO_ARCHIVO = ['pending', 'processing', 'review', 'committed', 'error'] as const
export type EstadoArchivo = (typeof ESTADO_ARCHIVO)[number]

export const ESTADO_DISCO = ['OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO', 'REPERFILADO'] as const
export type EstadoDisco = (typeof ESTADO_DISCO)[number]

export const METODO_OUTLIER = ['desviacion_estandar', 'iqr', 'umbral_fijo'] as const
export type MetodoOutlier = (typeof METODO_OUTLIER)[number]

export const TIPO_CARGA_ARCHIVO = ['csv_individual', 'migracion_masiva_excel'] as const
export type TipoCargaArchivo = (typeof TIPO_CARGA_ARCHIVO)[number]

export const ETAPA_EDICION = ['pre_commit', 'post_commit'] as const
export type EtapaEdicion = (typeof ETAPA_EDICION)[number]

export const TIPO_EVENTO_CALENDARIO = ['cambio', 'reperfilado', 'revision'] as const
export type TipoEventoCalendario = (typeof TIPO_EVENTO_CALENDARIO)[number]

export const ESTADO_EVENTO_CALENDARIO = ['programado', 'realizado', 'cancelado'] as const
export type EstadoEventoCalendario = (typeof ESTADO_EVENTO_CALENDARIO)[number]

export const SEVERIDAD_NOTIFICACION = ['info', 'advertencia', 'critico'] as const
export type SeveridadNotificacion = (typeof SEVERIDAD_NOTIFICACION)[number]

export const TIPO_NOTIFICACION = [
  'disco_critico',
  'solicitud_registro_pendiente',
  'outlier_detectado',
  'evento_calendario_proximo',
  'password_temporal_generada',
  // Generada por SystemParamsService al aceptar un cambio de percentil que
  // ajustó el extremo inferior del consenso a consenso_extremo_epsilon
  // (Regla B, ver ConsensoValidationService).
  'consenso_extremo_ajustado',
] as const
export type TipoNotificacion = (typeof TIPO_NOTIFICACION)[number]

export const FORMATO_REPORTE = ['pdf', 'excel'] as const
export type FormatoReporte = (typeof FORMATO_REPORTE)[number]
