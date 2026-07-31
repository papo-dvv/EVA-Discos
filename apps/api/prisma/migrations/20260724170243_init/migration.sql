-- CreateEnum
CREATE TYPE "ModeloTren" AS ENUM ('ansaldo_mb300', 'alstom_metropolis9000');

-- CreateEnum
CREATE TYPE "EstadoTren" AS ENUM ('operativo', 'mantenimiento', 'baja');

-- CreateEnum
CREATE TYPE "TipoCoche" AS ENUM ('MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2');

-- CreateEnum
CREATE TYPE "LadoDisco" AS ENUM ('izquierdo', 'derecho');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('administrador', 'supervisor', 'tecnico_medicion', 'tecnico_analisis', 'operador_almacen', 'auditor', 'solo_lectura');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('pendiente_aprobacion', 'activo', 'rechazado', 'bloqueado');

-- CreateEnum
CREATE TYPE "TipoResetPassword" AS ENUM ('admin_manual', 'temporal_por_email');

-- CreateEnum
CREATE TYPE "EstadoArchivo" AS ENUM ('pending', 'processing', 'review', 'committed', 'error');

-- CreateEnum
CREATE TYPE "EstadoDisco" AS ENUM ('OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO');

-- CreateEnum
CREATE TYPE "MetodoOutlier" AS ENUM ('desviacion_estandar', 'iqr', 'umbral_fijo');

-- CreateEnum
CREATE TYPE "TipoCargaArchivo" AS ENUM ('csv_individual', 'migracion_masiva_excel');

-- CreateEnum
CREATE TYPE "EtapaEdicion" AS ENUM ('pre_commit', 'post_commit');

-- CreateEnum
CREATE TYPE "TipoEventoCalendario" AS ENUM ('cambio', 'reperfilado', 'revision');

-- CreateEnum
CREATE TYPE "EstadoEventoCalendario" AS ENUM ('programado', 'realizado', 'cancelado');

-- CreateEnum
CREATE TYPE "SeveridadNotificacion" AS ENUM ('info', 'advertencia', 'critico');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('disco_critico', 'solicitud_registro_pendiente', 'outlier_detectado', 'evento_calendario_proximo', 'password_temporal_generada');

-- CreateEnum
CREATE TYPE "FormatoReporte" AS ENUM ('pdf', 'excel');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nombres_completos" VARCHAR(200) NOT NULL,
    "dni" VARCHAR(15) NOT NULL,
    "foto_url" VARCHAR(500),
    "area" VARCHAR(150) NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "empresa" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "pregunta_seguridad" VARCHAR(300),
    "respuesta_seguridad_hash" VARCHAR(255),
    "estado_cuenta" "EstadoCuenta" NOT NULL DEFAULT 'pendiente_aprobacion',
    "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false,
    "es_usuario_sistema" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completado" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_modulo" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "revisado_por" UUID,
    "fecha_revision" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tipo" "TipoResetPassword" NOT NULL,
    "token_hash" VARCHAR(255),
    "expira_en" TIMESTAMPTZ(6),
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "generado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trains" (
    "id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "modelo" "ModeloTren" NOT NULL,
    "color" VARCHAR(50) NOT NULL,
    "velocidad_max_kmh" DECIMAL(5,2),
    "estado" "EstadoTren" NOT NULL DEFAULT 'operativo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bogie_catalog" (
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(150),

    CONSTRAINT "bogie_catalog_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "contacto" VARCHAR(200),
    "telefono" VARCHAR(30),
    "email" VARCHAR(200),
    "registrado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wagon_units" (
    "id" UUID NOT NULL,
    "numero_coche" INTEGER NOT NULL,
    "tipo_coche" "TipoCoche" NOT NULL,
    "tren_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wagon_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brake_discs" (
    "id" UUID NOT NULL,
    "wagon_unit_id" UUID NOT NULL,
    "bogie_codigo" VARCHAR(10) NOT NULL,
    "eje_numero" INTEGER NOT NULL,
    "lado" "LadoDisco" NOT NULL,
    "rueda_numero" INTEGER,
    "proveedor_id" UUID,
    "fecha_instalacion" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brake_discs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(300) NOT NULL,
    "tipo_carga" "TipoCargaArchivo" NOT NULL DEFAULT 'csv_individual',
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EstadoArchivo" NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER,
    "valid_rows" INTEGER,
    "invalid_rows" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_records" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "disc_id" UUID,
    "responsable_nombre" VARCHAR(200) NOT NULL,
    "tren_numero" INTEGER NOT NULL,
    "kilometraje" DECIMAL(12,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" VARCHAR(100) NOT NULL,
    "t_value" DECIMAL(6,3) NOT NULL,
    "h_value" DECIMAL(6,3) NOT NULL,
    "rd_value" DOUBLE PRECISION NOT NULL,
    "estado_calculado" "EstadoDisco",
    "estado_sugerido_excel" VARCHAR(50),
    "es_outlier" BOOLEAN NOT NULL DEFAULT false,
    "metodo_outlier_aplicado" "MetodoOutlier",
    "excluido_de_trazabilidad" BOOLEAN NOT NULL DEFAULT false,
    "valido" BOOLEAN NOT NULL DEFAULT true,
    "motivo_invalidez" VARCHAR(300),
    "hoja_excel_origen" VARCHAR(10),
    "tren_original_excel" INTEGER,
    "corregido_por_hoja" BOOLEAN NOT NULL DEFAULT false,
    "discrepancia_estado_excel" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_edit_log" (
    "id" UUID NOT NULL,
    "file_id" UUID,
    "scan_record_id" UUID,
    "etapa" "EtapaEdicion" NOT NULL DEFAULT 'pre_commit',
    "campo_editado" VARCHAR(100) NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "usuario_id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_edit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disc_comments" (
    "id" UUID NOT NULL,
    "disc_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "comentario" TEXT NOT NULL,
    "accion_sugerida" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disc_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "disc_id" UUID,
    "tren_id" UUID,
    "tipo" "TipoEventoCalendario" NOT NULL,
    "fecha_programada" DATE NOT NULL,
    "sugerido_por_sistema" BOOLEAN NOT NULL DEFAULT false,
    "agendado_por" UUID NOT NULL,
    "responsable_asignado" UUID,
    "motivo" TEXT,
    "estado" "EstadoEventoCalendario" NOT NULL DEFAULT 'programado',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "rol_destino" "RolUsuario",
    "tipo" "TipoNotificacion" NOT NULL,
    "severidad" "SeveridadNotificacion" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enviar_email" BOOLEAN NOT NULL DEFAULT false,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_requests" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo_reporte" VARCHAR(100) NOT NULL,
    "filtros" JSONB,
    "formato" "FormatoReporte" NOT NULL,
    "generado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url_archivo" VARCHAR(500),

    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_params" (
    "clave" VARCHAR(100) NOT NULL,
    "valor" VARCHAR(300) NOT NULL,
    "descripcion" VARCHAR(500),
    "actualizado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_params_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_dni_key" ON "users"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_rol" ON "users"("rol");

-- CreateIndex
CREATE INDEX "idx_users_estado_cuenta" ON "users"("estado_cuenta");

-- CreateIndex
CREATE INDEX "idx_registration_requests_estado" ON "registration_requests"("estado");

-- CreateIndex
CREATE INDEX "idx_password_resets_user" ON "password_resets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trains_numero_key" ON "trains"("numero");

-- CreateIndex
CREATE INDEX "idx_trains_modelo" ON "trains"("modelo");

-- CreateIndex
CREATE UNIQUE INDEX "wagon_units_numero_coche_key" ON "wagon_units"("numero_coche");

-- CreateIndex
CREATE INDEX "idx_wagon_units_tren" ON "wagon_units"("tren_id");

-- CreateIndex
CREATE INDEX "idx_brake_discs_wagon" ON "brake_discs"("wagon_unit_id");

-- CreateIndex
CREATE INDEX "idx_brake_discs_proveedor" ON "brake_discs"("proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "brake_discs_wagon_unit_id_bogie_codigo_eje_numero_lado_key" ON "brake_discs"("wagon_unit_id", "bogie_codigo", "eje_numero", "lado");

-- CreateIndex
CREATE INDEX "idx_uploaded_files_status" ON "uploaded_files"("status");

-- CreateIndex
CREATE INDEX "idx_uploaded_files_tipo_carga" ON "uploaded_files"("tipo_carga");

-- CreateIndex
CREATE INDEX "idx_scan_records_file" ON "scan_records"("file_id");

-- CreateIndex
CREATE INDEX "idx_scan_records_disc" ON "scan_records"("disc_id");

-- CreateIndex
CREATE INDEX "idx_scan_records_fecha" ON "scan_records"("fecha");

-- CreateIndex
CREATE INDEX "idx_scan_records_estado" ON "scan_records"("estado_calculado");

-- CreateIndex
CREATE INDEX "idx_scan_records_disc_fecha" ON "scan_records"("disc_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_scan_edit_log_file" ON "scan_edit_log"("file_id");

-- CreateIndex
CREATE INDEX "idx_scan_edit_log_record" ON "scan_edit_log"("scan_record_id");

-- CreateIndex
CREATE INDEX "idx_scan_edit_log_etapa" ON "scan_edit_log"("etapa");

-- CreateIndex
CREATE INDEX "idx_disc_comments_disc" ON "disc_comments"("disc_id");

-- CreateIndex
CREATE INDEX "idx_calendar_events_fecha" ON "calendar_events"("fecha_programada");

-- CreateIndex
CREATE INDEX "idx_calendar_events_disc" ON "calendar_events"("disc_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notifications_leido" ON "notifications"("leido");

-- CreateIndex
CREATE INDEX "idx_report_requests_usuario" ON "report_requests"("usuario_id");

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_generado_por_fkey" FOREIGN KEY ("generado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wagon_units" ADD CONSTRAINT "wagon_units_tren_id_fkey" FOREIGN KEY ("tren_id") REFERENCES "trains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brake_discs" ADD CONSTRAINT "brake_discs_wagon_unit_id_fkey" FOREIGN KEY ("wagon_unit_id") REFERENCES "wagon_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brake_discs" ADD CONSTRAINT "brake_discs_bogie_codigo_fkey" FOREIGN KEY ("bogie_codigo") REFERENCES "bogie_catalog"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brake_discs" ADD CONSTRAINT "brake_discs_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "uploaded_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_records" ADD CONSTRAINT "scan_records_disc_id_fkey" FOREIGN KEY ("disc_id") REFERENCES "brake_discs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_edit_log" ADD CONSTRAINT "scan_edit_log_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "uploaded_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_edit_log" ADD CONSTRAINT "scan_edit_log_scan_record_id_fkey" FOREIGN KEY ("scan_record_id") REFERENCES "scan_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_edit_log" ADD CONSTRAINT "scan_edit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disc_comments" ADD CONSTRAINT "disc_comments_disc_id_fkey" FOREIGN KEY ("disc_id") REFERENCES "brake_discs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disc_comments" ADD CONSTRAINT "disc_comments_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_disc_id_fkey" FOREIGN KEY ("disc_id") REFERENCES "brake_discs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tren_id_fkey" FOREIGN KEY ("tren_id") REFERENCES "trains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_agendado_por_fkey" FOREIGN KEY ("agendado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_responsable_asignado_fkey" FOREIGN KEY ("responsable_asignado") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_params" ADD CONSTRAINT "system_params_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
