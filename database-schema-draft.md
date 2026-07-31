# Base de Datos — EVA (de Línea 1 de Lima)

Este documento es el resumen conceptual del modelo de datos. **El script ejecutable y definitivo está en `schema_eva.sql`** — este archivo se mantiene como referencia rápida de lectura, ya sin preguntas abiertas (todas las decisiones de las secciones 1-5 quedaron confirmadas y están reflejadas en el script SQL).

---

## 1. Catálogos (datos maestros)

```sql
-- Catálogo de trenes
trains (
  id, numero INTEGER UNIQUE,        -- 1-5 = Ansaldo, 6-44 = Alstom (39 unidades, únicas incluidas por ahora)
  modelo VARCHAR,                    -- 'ansaldo_mb300' | 'alstom_metropolis9000'
  color VARCHAR,                     -- 'rojo' | 'verde_blanco'
  velocidad_max_kmh NUMERIC,
  estado VARCHAR,                    -- 'operativo' | 'mantenimiento' | 'baja'
  created_at
)

-- Catálogo de coches (vagones físicos) — unidad física identificable.
-- Los vagones NO son intercambiables entre trenes: tren_id es una relación fija.
wagon_units (
  id, numero_coche INTEGER UNIQUE,   -- ej. 129, 130, 508, 408, 131 (el "N° Coche" del CSV/Excel)
  tipo_coche VARCHAR,                -- 'MA1' | 'MB1' | 'MB3' | 'REM' | 'MB2' | 'MA2'
  tren_id FK -> trains.id,           -- fijo, confirmado: los coches no se mueven de tren
  created_at
)

-- Catálogo de bogies (referencia fija, no cambia)
bogie_catalog (
  codigo VARCHAR PRIMARY KEY,        -- 'PB2' | 'PB3' | 'PB4' | 'PB6' | 'TB1' | 'TB2'
  descripcion VARCHAR
)

-- Discos de freno físicos — identificados por coche + bogie + eje + lado.
-- rueda_numero es la rueda asignada a ese disco (impar = izquierda, par = derecha,
-- según la convención de numeración de la flota); es un dato de referencia, no
-- una llave — la llave física real es (wagon_unit_id, bogie_codigo, eje_numero, lado).
brake_discs (
  id, wagon_unit_id FK -> wagon_units.id,
  bogie_codigo FK -> bogie_catalog.codigo,
  eje_numero INTEGER,
  lado VARCHAR,                      -- 'izquierdo' | 'derecho'
  rueda_numero INTEGER,
  proveedor_id FK -> providers.id NULLABLE,
  fecha_instalacion DATE NULLABLE,
  activo BOOLEAN DEFAULT true,
  UNIQUE (wagon_unit_id, bogie_codigo, eje_numero, lado)
)

-- Proveedores de repuestos
providers (
  id, nombre, contacto, telefono, email,
  registrado_por FK -> users.id,      -- admin u operador, sin login propio
  created_at
)
```

---

## 2. Ingesta de mediciones (CSV individual y migración masiva de Excel)

Dos orígenes posibles, distinguidos por `uploaded_files.tipo_carga`:
- **`csv_individual`**: el flujo normal y recurrente de carga de un técnico (una sesión de escaneo).
- **`migracion_masiva_excel`**: carga única, exclusiva del rol Administrador, del archivo con las 39 hojas (`T06` a `T44`) que contiene el historial existente. No se repite una vez migrado.

```sql
uploaded_files (
  id, filename,
  tipo_carga VARCHAR,                 -- 'csv_individual' | 'migracion_masiva_excel'
  uploaded_by FK -> users.id, uploaded_at,
  status VARCHAR,                     -- 'pending' | 'processing' | 'review' | 'committed' | 'error'
  total_rows, valid_rows, invalid_rows,
  error_message NULLABLE
)

-- Registro de cada fila procesada, ya validado y con los valores recalculados
-- por el backend (nunca se confía en T-H ni en "Comentario" del Excel/CSV).
scan_records (
  id, file_id FK -> uploaded_files.id,
  disc_id FK -> brake_discs.id,        -- resuelto por wagon+bogie+eje+lado
  responsable_nombre VARCHAR,          -- texto libre; puede no tener usuario en EVA (confirmado)
  tren_numero INTEGER,
  kilometraje NUMERIC,
  fecha DATE,
  motivo VARCHAR,                      -- 'Medición' | 'Cambio' | 'Reperfilado' | ...
  t_value NUMERIC,
  h_value NUMERIC,
  rd_value NUMERIC,                    -- GENERATED: T - H, recalculado siempre
  estado_calculado VARCHAR,            -- 'OK'|'SEGUIMIENTO'|'CAMBIO'|'CRITICO' — la "verdad absoluta", por disco individual
  estado_sugerido_excel VARCHAR,       -- valor original de la columna "Comentario", solo referencia
  es_outlier BOOLEAN DEFAULT false,
  metodo_outlier_aplicado VARCHAR,     -- 'desviacion_estandar' | 'iqr' | 'umbral_fijo'
  excluido_de_trazabilidad BOOLEAN,    -- true si es outlier: queda en el registro, pero no entra a los cálculos
  valido BOOLEAN,
  motivo_invalidez VARCHAR NULLABLE,

  -- Exclusivos de la migración masiva desde Excel:
  hoja_excel_origen VARCHAR(10),       -- ej. 'T15'; NULL si vino de un CSV individual
  tren_original_excel INTEGER,         -- valor de "Tren" antes de corregir según la hoja (si hubo discrepancia)
  corregido_por_hoja BOOLEAN,          -- true si tren_numero fue corregido con el nombre de la hoja como fuente de verdad
  discrepancia_estado_excel BOOLEAN,   -- true si estado_calculado difiere del "Comentario" original (advertencia, no bloquea)

  created_at
)

-- Auditoría de ediciones, tanto en la vista previa (pre_commit) como sobre
-- datos ya guardados en la BD (post_commit). Las correcciones automáticas del
-- sistema (ej. corrección de Tren por hoja) quedan atribuidas al usuario
-- reservado "sistema" (users.es_usuario_sistema = true), no a un usuario NULL.
scan_edit_log (
  id, file_id FK -> uploaded_files.id NULLABLE, scan_record_id FK NULLABLE,
  etapa VARCHAR,                       -- 'pre_commit' | 'post_commit'
  campo_editado VARCHAR, valor_anterior, valor_nuevo,
  usuario_id FK -> users.id,           -- usuario real, o el usuario "sistema"
  timestamp
)
```

**Nota sobre `accion_recomendada` (Reperfilado / Cambio / Crítico a nivel de eje):** no se almacena en base de datos. Se calcula en el momento de mostrar el dato, cruzando el disco actual con la medición más reciente de su par en el mismo eje (izquierdo + derecho), aplicando primero la capa de seguridad de Crítico (Rd ≤ 0 en cualquiera de los dos lados) y luego la regla de H ≥ 1.6mm + (Rd − 0.8).

---

## 3. Usuarios, roles y accesos

```sql
users (
  id, nombres_completos, dni UNIQUE, foto_url NULLABLE,
  area VARCHAR,                       -- puede ser texto libre si es "otra área"
  rol VARCHAR,                        -- 'administrador' | 'supervisor' | 'tecnico_medicion' |
                                       -- 'tecnico_analisis' | 'operador_almacen' | 'auditor' | 'solo_lectura'
  empresa VARCHAR,
  email UNIQUE, password_hash,
  mfa_enabled BOOLEAN DEFAULT false,       -- opcional, Authy
  pregunta_seguridad VARCHAR NULLABLE,
  respuesta_seguridad_hash NULLABLE,
  estado_cuenta VARCHAR,                   -- 'pendiente_aprobacion' | 'activo' | 'rechazado' | 'bloqueado'
  debe_cambiar_password BOOLEAN DEFAULT false,  -- fuerza cambio en el próximo login
  es_usuario_sistema BOOLEAN DEFAULT false,     -- usuario reservado para acciones automáticas, sin login real
  created_at
)

registration_requests (
  id, user_id FK -> users.id,
  estado VARCHAR,                     -- 'pendiente' | 'aceptado' | 'rechazado'
  revisado_por FK -> users.id NULLABLE,
  fecha_revision NULLABLE
)

password_resets (
  id, user_id FK -> users.id,
  tipo VARCHAR,                       -- 'admin_manual' | 'temporal_por_email'
  token_hash NULLABLE, expira_en NULLABLE,
  usado BOOLEAN DEFAULT false,
  created_at
)
```

**Seeder inicial:** un usuario "sistema" bloqueado (sin login, solo para atribución en auditoría) y un usuario Administrador (`admin@eva-l1.local`, contraseña temporal `Eva#L1nea2026!`, `debe_cambiar_password = true`). Ambos ya están cargados como datos semilla en `schema_eva.sql`, con el hash generado directamente en SQL vía `pgcrypto` (`crypt()` + `gen_salt('bf')`), compatible con librerías bcrypt estándar del backend.

---

## 4. Trazabilidad, proyección y operaciones

```sql
-- Serie histórica: se arma consultando scan_records WHERE excluido_de_trazabilidad = false,
-- ordenado por disc_id + fecha. No hace falta tabla aparte, salvo que el volumen lo
-- justifique más adelante (se puede materializar como vista).

disc_comments (
  id, disc_id FK -> brake_discs.id,
  usuario_id FK -> users.id,
  comentario TEXT, accion_sugerida VARCHAR NULLABLE,
  created_at
)

calendar_events (
  id, disc_id FK -> brake_discs.id NULLABLE, tren_id FK -> trains.id NULLABLE,
  tipo VARCHAR,                        -- 'cambio' | 'reperfilado' | 'revision'
  fecha_programada DATE,
  sugerido_por_sistema BOOLEAN,
  agendado_por FK -> users.id,
  responsable_asignado FK -> users.id NULLABLE,
  motivo TEXT,
  estado VARCHAR                       -- 'programado' | 'realizado' | 'cancelado'
)
```

---

## 5. Notificaciones, reportes y parámetros

```sql
notifications (
  id, user_id FK -> users.id NULLABLE,  -- NULL = notificación a todo un rol
  rol_destino VARCHAR NULLABLE,
  tipo VARCHAR, severidad VARCHAR,       -- 'info' | 'advertencia' | 'critico'
  mensaje TEXT,
  enviar_email BOOLEAN DEFAULT false,
  leido BOOLEAN DEFAULT false,
  created_at
)

report_requests (
  id, usuario_id FK -> users.id,
  tipo_reporte VARCHAR,
  filtros JSONB,                          -- tren, mes, responsable, etc.
  formato VARCHAR,                        -- 'pdf' | 'excel'
  generado_en, url_archivo
)

system_params (
  clave VARCHAR PRIMARY KEY,              -- 'rd_umbral_ok', 'rd_umbral_seguimiento', 'rd_umbral_critico',
                                           -- 'h_umbral_reperfilado', 'reperfilado_descuento_rd',
                                           -- 'outlier_metodo', 'outlier_parametro', 'dias_anticipacion_agenda'
  valor VARCHAR,
  descripcion VARCHAR,
  actualizado_por FK -> users.id,
  actualizado_en
)
```

---

## 6. Reglas de negocio confirmadas (resumen)

**Estado del disco (`estado_calculado`, por disco individual — siempre igual, es el estándar):**

| Rd | Estado |
|---|---|
| Rd ≥ 1.00 mm | OK |
| 0.40 mm < Rd < 1.00 mm | Seguimiento |
| 0 < Rd ≤ 0.40 mm | Cambio |
| Rd ≤ 0 mm | Crítico |

**Acción recomendada (`accion_recomendada`, calculada al vuelo, evaluando el par del eje):**

1. Capa de seguridad: si Rd ≤ 0 en cualquiera de los dos lados → Crítico, cambio urgente.
2. Si H ≥ 1.6 mm en algún lado y (Rd de ese lado − 0.8) ≤ 0.4 → Cambio recomendado (aplica a ambos lados, es una sola pieza).
3. Si H ≥ 1.6 mm en algún lado y (Rd de ese lado − 0.8) > 0.4 → Reperfilado viable (se muestra en el lado que corresponde).
4. Si nada de lo anterior aplica → sin acción recomendada.

El umbral H = 1.6 mm es configurable (`system_params`), con este valor como estándar por defecto.

**Migración masiva de Excel:** única, no recurrente. El sistema confía en el nombre de la hoja (T06-T44) sobre el valor de la columna "Tren" de cada fila; si difieren, corrige y dejar rastro en `tren_original_excel` + `scan_edit_log`. Las columnas T-H y "Comentario" del Excel se usan solo para validación cruzada (advertencia si no coincide con el cálculo del backend, que siempre tiene prioridad). Las columnas "Medición", "Nueva Proyección" y "Comentario 2" se ignoran por completo.
