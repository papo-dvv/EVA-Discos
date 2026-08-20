CREATE TABLE IF NOT EXISTS migration_history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(40) NOT NULL,
  file_id UUID NULL,
  nombre_archivo VARCHAR(300) NULL,
  alcance VARCHAR(40) NULL,
  marca VARCHAR(20) NULL,
  tren_numero INT NULL,
  total_filas INT NULL,
  filas_validas INT NULL,
  filas_invalidas INT NULL,
  detalle TEXT NULL,
  usuario_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migration_history_events_created_at
  ON migration_history_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_migration_history_events_tipo
  ON migration_history_events(tipo);
