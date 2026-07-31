-- ============================================================================
-- EVA — de Línea 1 de Lima
-- Script de base de datos PostgreSQL
-- Sistema de trazabilidad de discos de freno — Metro de Lima Línea 1
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ============================================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================================

CREATE TYPE modelo_tren AS ENUM ('ansaldo_mb300', 'alstom_metropolis9000');
CREATE TYPE estado_tren AS ENUM ('operativo', 'mantenimiento', 'baja');

CREATE TYPE tipo_coche AS ENUM ('MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2');
CREATE TYPE lado_disco AS ENUM ('izquierdo', 'derecho');

CREATE TYPE rol_usuario AS ENUM (
  'administrador', 'supervisor', 'tecnico_medicion',
  'tecnico_analisis', 'operador_almacen', 'auditor', 'solo_lectura'
);
CREATE TYPE estado_cuenta AS ENUM ('pendiente_aprobacion', 'activo', 'rechazado', 'bloqueado');
CREATE TYPE tipo_reset_password AS ENUM ('admin_manual', 'temporal_por_email');

CREATE TYPE estado_archivo AS ENUM ('pending', 'processing', 'review', 'committed', 'error');
CREATE TYPE estado_disco AS ENUM ('OK', 'SEGUIMIENTO', 'CAMBIO', 'CRITICO');
CREATE TYPE metodo_outlier AS ENUM ('desviacion_estandar', 'iqr', 'umbral_fijo');
CREATE TYPE tipo_carga_archivo AS ENUM ('csv_individual', 'migracion_masiva_excel');
CREATE TYPE etapa_edicion AS ENUM ('pre_commit', 'post_commit');

CREATE TYPE tipo_evento_calendario AS ENUM ('cambio', 'reperfilado', 'revision');
CREATE TYPE estado_evento_calendario AS ENUM ('programado', 'realizado', 'cancelado');

CREATE TYPE severidad_notificacion AS ENUM ('info', 'advertencia', 'critico');
CREATE TYPE tipo_notificacion AS ENUM (
  'disco_critico', 'solicitud_registro_pendiente', 'outlier_detectado',
  'evento_calendario_proximo', 'password_temporal_generada'
);
CREATE TYPE formato_reporte AS ENUM ('pdf', 'excel');

-- ============================================================================
-- 2. USUARIOS Y ACCESOS
-- ============================================================================

CREATE TABLE users (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres_completos           VARCHAR(200) NOT NULL,
  dni                         VARCHAR(15) UNIQUE NOT NULL,
  foto_url                    VARCHAR(500),
  area                        VARCHAR(150) NOT NULL, -- texto libre si es "otra área"
  rol                         rol_usuario NOT NULL,
  empresa                     VARCHAR(200) NOT NULL,
  email                       VARCHAR(200) UNIQUE NOT NULL,
  password_hash               VARCHAR(255) NOT NULL,
  mfa_enabled                 BOOLEAN NOT NULL DEFAULT false, -- Authy, opcional
  pregunta_seguridad          VARCHAR(300),
  respuesta_seguridad_hash    VARCHAR(255),
  estado_cuenta               estado_cuenta NOT NULL DEFAULT 'pendiente_aprobacion',
  debe_cambiar_password       BOOLEAN NOT NULL DEFAULT false, -- fuerza cambio en el próximo login (ej. tras password temporal)
  es_usuario_sistema          BOOLEAN NOT NULL DEFAULT false, -- usuario reservado para acciones automáticas (ver scan_edit_log)
  onboarding_completado       BOOLEAN NOT NULL DEFAULT false,
  onboarding_modulo           VARCHAR(20), -- 'discos' | 'ruedas'
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_rol ON users(rol);
CREATE INDEX idx_users_estado_cuenta ON users(estado_cuenta);

CREATE TABLE registration_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estado           VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'aceptado' | 'rechazado'
  revisado_por     UUID REFERENCES users(id),
  fecha_revision   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_registration_requests_estado ON registration_requests(estado);

CREATE TABLE password_resets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo         tipo_reset_password NOT NULL,
  token_hash   VARCHAR(255),
  expira_en    TIMESTAMPTZ,
  usado        BOOLEAN NOT NULL DEFAULT false,
  generado_por UUID REFERENCES users(id), -- admin que lo generó, si fue manual
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- ============================================================================
-- 3. FLOTA: TRENES, COCHES, BOGIES, DISCOS
-- ============================================================================

CREATE TABLE trains (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             INTEGER UNIQUE NOT NULL, -- 1-5 Ansaldo, 6-44 Alstom
  modelo             modelo_tren NOT NULL,
  color              VARCHAR(50) NOT NULL,     -- 'rojo' | 'verde_blanco'
  velocidad_max_kmh  NUMERIC(5,2),
  estado             estado_tren NOT NULL DEFAULT 'operativo',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_train_numero CHECK (numero BETWEEN 1 AND 44)
);
CREATE INDEX idx_trains_modelo ON trains(modelo);

CREATE TABLE bogie_catalog (
  codigo        VARCHAR(10) PRIMARY KEY, -- 'PB2' | 'PB3' | 'PB4' | 'PB6' | 'TB1' | 'TB2'
  descripcion   VARCHAR(150)
);

CREATE TABLE providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(200) NOT NULL,
  contacto        VARCHAR(200),
  telefono        VARCHAR(30),
  email           VARCHAR(200),
  registrado_por  UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coches (vagones físicos). Los vagones NO son intercambiables entre trenes:
-- la relación con trains es fija.
CREATE TABLE wagon_units (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_coche   INTEGER UNIQUE NOT NULL, -- "N° Coche" del CSV (ej. 129, 130, 508, 408, 131)
  tipo_coche     tipo_coche NOT NULL,     -- "Coche" del CSV (MA1, MB1, MB3, REM, MB2, MA2)
  tren_id        UUID NOT NULL REFERENCES trains(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wagon_units_tren ON wagon_units(tren_id);

-- Discos de freno físicos, identificados por coche + bogie + eje + lado.
-- "rueda_numero" es la rueda asignada a ese disco (impar = izquierda, par = derecha,
-- según la convención de numeración de ruedas de la flota). Se guarda como dato
-- informativo/de referencia, no como llave: la llave física real es
-- (wagon_unit_id, bogie_codigo, eje_numero, lado).
CREATE TABLE brake_discs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wagon_unit_id      UUID NOT NULL REFERENCES wagon_units(id),
  bogie_codigo       VARCHAR(10) NOT NULL REFERENCES bogie_catalog(codigo),
  eje_numero         INTEGER NOT NULL,
  lado               lado_disco NOT NULL,
  rueda_numero       INTEGER,             -- referencia informativa (ver nota arriba)
  proveedor_id       UUID REFERENCES providers(id),
  fecha_instalacion  DATE,
  activo             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wagon_unit_id, bogie_codigo, eje_numero, lado)
);
CREATE INDEX idx_brake_discs_wagon ON brake_discs(wagon_unit_id);
CREATE INDEX idx_brake_discs_proveedor ON brake_discs(proveedor_id);

-- ============================================================================
-- 4. INGESTA DE CSV Y REGISTROS DE MEDICIÓN
-- ============================================================================

CREATE TABLE uploaded_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      VARCHAR(300) NOT NULL,
  tipo_carga    tipo_carga_archivo NOT NULL DEFAULT 'csv_individual', -- 'migracion_masiva_excel' = las 39 hojas, solo Administrador
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        estado_archivo NOT NULL DEFAULT 'pending',
  total_rows    INTEGER,
  valid_rows    INTEGER,
  invalid_rows  INTEGER,
  error_message TEXT
);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(status);
CREATE INDEX idx_uploaded_files_tipo_carga ON uploaded_files(tipo_carga);

-- Registro de cada fila procesada del CSV. El estado se RECALCULA siempre por el
-- sistema a partir de Rd (estado_calculado); lo que traía el Excel en su columna
-- "Comentario" (ej. "Cambio", "Reperfilado") se conserva aparte como referencia,
-- sin usarse para el cálculo — es el "estado sugerido" que traía la planilla.
CREATE TABLE scan_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id                   UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  disc_id                   UUID REFERENCES brake_discs(id),
  responsable_nombre        VARCHAR(200) NOT NULL, -- texto libre; puede no tener usuario en EVA
  tren_numero               INTEGER NOT NULL,
  kilometraje               NUMERIC(12,2) NOT NULL,
  fecha                     DATE NOT NULL,
  motivo                    VARCHAR(100) NOT NULL, -- 'Medición' | 'Verificación cambio' | 'Reperfilado' | ...
  t_value                   NUMERIC(6,3) NOT NULL,
  h_value                   NUMERIC(6,3) NOT NULL,
  rd_value                  NUMERIC(6,3) GENERATED ALWAYS AS (t_value - h_value) STORED,
  estado_calculado          estado_disco,           -- calculado por el sistema según reglas de negocio
  estado_sugerido_excel     VARCHAR(50),            -- valor original de la columna "Comentario" del CSV
  es_outlier                BOOLEAN NOT NULL DEFAULT false,
  metodo_outlier_aplicado   metodo_outlier,
  excluido_de_trazabilidad  BOOLEAN NOT NULL DEFAULT false,
  valido                    BOOLEAN NOT NULL DEFAULT true,
  motivo_invalidez          VARCHAR(300),

  -- Campos exclusivos de la migración masiva desde Excel (39 hojas T06-T44)
  hoja_excel_origen         VARCHAR(10),            -- ej. 'T15', NULL si vino de un CSV individual
  tren_original_excel       INTEGER,                -- valor de la columna "Tren" ANTES de corregir por la hoja
  corregido_por_hoja        BOOLEAN NOT NULL DEFAULT false, -- true si tren_numero fue corregido según el nombre de la hoja
  discrepancia_estado_excel BOOLEAN NOT NULL DEFAULT false, -- true si estado_calculado difiere de estado_sugerido_excel

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scan_records_file ON scan_records(file_id);
CREATE INDEX idx_scan_records_disc ON scan_records(disc_id);
CREATE INDEX idx_scan_records_fecha ON scan_records(fecha);
CREATE INDEX idx_scan_records_estado ON scan_records(estado_calculado);
CREATE INDEX idx_scan_records_disc_fecha ON scan_records(disc_id, fecha); -- clave para trazabilidad

-- Auditoría de ediciones CRUD, tanto en la vista previa (pre_commit) como sobre
-- datos ya guardados en la base de datos (post_commit). Las correcciones
-- automáticas del sistema (ej. corrección de Tren según la hoja de origen)
-- también quedan aquí, usando el usuario reservado "es_usuario_sistema = true".
CREATE TABLE scan_edit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id          UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
  scan_record_id   UUID REFERENCES scan_records(id) ON DELETE SET NULL,
  etapa            etapa_edicion NOT NULL DEFAULT 'pre_commit',
  campo_editado    VARCHAR(100) NOT NULL,
  valor_anterior   TEXT,
  valor_nuevo      TEXT,
  usuario_id       UUID NOT NULL REFERENCES users(id), -- usuario real, o el usuario "sistema" si fue automático
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scan_edit_log_file ON scan_edit_log(file_id);
CREATE INDEX idx_scan_edit_log_record ON scan_edit_log(scan_record_id);
CREATE INDEX idx_scan_edit_log_etapa ON scan_edit_log(etapa);

-- ============================================================================
-- 5. OPERACIONES Y CALENDARIO
-- ============================================================================

CREATE TABLE disc_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disc_id           UUID NOT NULL REFERENCES brake_discs(id) ON DELETE CASCADE,
  usuario_id        UUID NOT NULL REFERENCES users(id),
  comentario        TEXT NOT NULL,
  accion_sugerida   VARCHAR(200),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disc_comments_disc ON disc_comments(disc_id);

CREATE TABLE calendar_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disc_id                UUID REFERENCES brake_discs(id),
  tren_id                UUID REFERENCES trains(id),
  tipo                   tipo_evento_calendario NOT NULL,
  fecha_programada       DATE NOT NULL,
  sugerido_por_sistema   BOOLEAN NOT NULL DEFAULT false,
  agendado_por           UUID NOT NULL REFERENCES users(id),
  responsable_asignado   UUID REFERENCES users(id),
  motivo                 TEXT,
  estado                 estado_evento_calendario NOT NULL DEFAULT 'programado',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_events_fecha ON calendar_events(fecha_programada);
CREATE INDEX idx_calendar_events_disc ON calendar_events(disc_id);

-- ============================================================================
-- 6. NOTIFICACIONES, REPORTES Y PARÁMETROS
-- ============================================================================

CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id), -- NULL si es para todo un rol
  rol_destino    rol_usuario,
  tipo           tipo_notificacion NOT NULL,
  severidad      severidad_notificacion NOT NULL,
  mensaje        TEXT NOT NULL,
  enviar_email   BOOLEAN NOT NULL DEFAULT false,
  leido          BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_leido ON notifications(leido);

CREATE TABLE report_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES users(id),
  tipo_reporte    VARCHAR(100) NOT NULL,
  filtros         JSONB,
  formato         formato_reporte NOT NULL,
  generado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  url_archivo     VARCHAR(500)
);
CREATE INDEX idx_report_requests_usuario ON report_requests(usuario_id);

CREATE TABLE system_params (
  clave             VARCHAR(100) PRIMARY KEY,
  valor             VARCHAR(300) NOT NULL,
  descripcion       VARCHAR(500),
  actualizado_por   UUID REFERENCES users(id),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. DATOS SEMILLA (catálogos fijos y parámetros por defecto)
-- ============================================================================

INSERT INTO bogie_catalog (codigo, descripcion) VALUES
  ('PB2', 'Bogie motor tipo 2'),
  ('PB3', 'Bogie motor tipo 3'),
  ('PB4', 'Bogie motor tipo 4'),
  ('PB6', 'Bogie motor tipo 6'),
  ('TB1', 'Bogie remolque tipo 1'),
  ('TB2', 'Bogie remolque tipo 2');

INSERT INTO system_params (clave, valor, descripcion) VALUES
  ('rd_umbral_ok',                '1.00', 'Rd mínimo para estado OK (mm)'),
  ('rd_umbral_seguimiento',       '0.40', 'Rd mínimo para estado Seguimiento, por debajo de OK (mm)'),
  ('rd_umbral_critico',           '0.00', 'Rd igual o menor a este valor es estado Crítico (mm)'),
  ('h_umbral_reperfilado',        '1.60', 'H mínimo para que el reperfilado sea viable (mm)'),
  ('reperfilado_descuento_rd',    '0.80', 'Cuánto se descuenta a Rd tras un reperfilado (mm)'),
  ('outlier_metodo',              'iqr',  'Método activo de detección de outliers: desviacion_estandar | iqr | umbral_fijo'),
  ('outlier_parametro',           '1.5',  'Parámetro del método de outlier activo (ej. multiplicador IQR)'),
  ('dias_anticipacion_agenda',    '15',   'Días de anticipación para sugerir agendar un cambio/reperfilado');

-- Usuario reservado "sistema": usado para atribuir en scan_edit_log las
-- correcciones automáticas (ej. corrección de Tren según la hoja de origen)
-- que no las hizo una persona. Queda bloqueado para login.
INSERT INTO users (
  id, nombres_completos, dni, area, rol, empresa, email, password_hash,
  estado_cuenta, debe_cambiar_password, es_usuario_sistema
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sistema EVA', '00000000', 'Sistema', 'administrador', 'EVA',
  'sistema@eva-l1.local',
  crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')), -- hash de una contraseña aleatoria, no se usa para login
  'bloqueado', false, true
);

-- Usuario administrador inicial (seeder). Contraseña temporal: Eva#L1nea2026!
-- debe_cambiar_password = true fuerza el cambio en el primer inicio de sesión.
-- pgcrypto genera el hash directamente en formato bcrypt ($2a$), compatible
-- con librerías bcrypt estándar en el backend (ej. bcrypt/bcryptjs de Node).
INSERT INTO users (
  nombres_completos, dni, area, rol, empresa, email, password_hash,
  estado_cuenta, debe_cambiar_password
) VALUES (
  'Administrador EVA', '00000001', 'Administración de Sistemas', 'administrador', 'UNNA',
  'admin@eva-l1.local',
  crypt('Eva#L1nea2026!', gen_salt('bf')),
  'activo', true
);

-- Trenes: 1-5 Ansaldo MB-300 (rojo), 6-44 Alstom Metropolis 9000 (verde/blanco)
INSERT INTO trains (numero, modelo, color, velocidad_max_kmh, estado)
SELECT n, 'ansaldo_mb300', 'rojo', 90, 'operativo'
FROM generate_series(1, 5) AS n;

INSERT INTO trains (numero, modelo, color, velocidad_max_kmh, estado)
SELECT n, 'alstom_metropolis9000', 'verde_blanco', 80, 'operativo'
FROM generate_series(6, 44) AS n;

-- ============================================================================
-- 8. NOTAS DE IMPLEMENTACIÓN
-- ============================================================================
-- - rd_value es una columna GENERATED (T - H), nunca se inserta manualmente ni
--   se confía en el "T-H" que traiga el Excel: siempre se recalcula.
-- - estado_calculado se llena desde el backend (motor de reglas), no vía trigger,
--   para poder testear la lógica de negocio de forma aislada (ver BrakeDiscRulesService
--   en el plan de desarrollo).
-- - excluido_de_trazabilidad = true marca las filas detectadas como outlier: quedan
--   en scan_records (registro de reportes) pero las consultas de Trazabilidad y
--   Proyección deben filtrar WHERE excluido_de_trazabilidad = false.
-- - wagon_units.tren_id es fijo (los coches no se intercambian entre trenes).
-- - responsable_nombre es texto libre a propósito: no todo técnico que aparece en
--   el historial de mediciones tiene necesariamente un usuario creado en EVA.
--
-- Migración masiva desde Excel (39 hojas T06-T44) — pantalla exclusiva de Administrador:
-- - Es una migración ÚNICA del historial existente, no un mecanismo recurrente. Las
--   mediciones nuevas de ahí en adelante entran por el flujo normal de CSV individual.
-- - El sistema confía siempre en el nombre de la hoja (ej. T15 = Tren 15), no en el
--   valor de la columna "Tren" de cada fila. Si no coinciden, se corrige al guardar,
--   se conserva el valor original en tren_original_excel, y queda un registro en
--   scan_edit_log (etapa='pre_commit', usuario_id = usuario "sistema").
-- - Las columnas T-H y "Comentario" del Excel (fórmulas) NUNCA se usan como fuente de
--   cálculo — se leen únicamente para la validación cruzada: si estado_calculado
--   difiere de lo que decía "Comentario", se marca discrepancia_estado_excel = true
--   como advertencia informativa. El cálculo del backend siempre tiene prioridad.
-- - accion_recomendada (Reperfilado/Cambio/Crítico a nivel de eje, evaluando ambos
--   lados) NO se almacena: se calcula al momento de mostrar el dato, cruzando cada
--   disco con la medición más reciente de su par en el mismo eje.
-- - Las columnas "Medición", "Nueva Proyección" y "Comentario 2" del Excel se ignoran
--   por completo, no se leen ni se guardan.
