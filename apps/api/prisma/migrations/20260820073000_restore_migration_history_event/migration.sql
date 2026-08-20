CREATE TABLE IF NOT EXISTS "migration_history_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tipo" VARCHAR(40) NOT NULL,
  "file_id" UUID,
  "nombre_archivo" VARCHAR(300),
  "alcance" VARCHAR(40),
  "marca" VARCHAR(20),
  "tren_numero" INTEGER,
  "total_filas" INTEGER,
  "filas_validas" INTEGER,
  "filas_invalidas" INTEGER,
  "detalle" TEXT,
  "usuario_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "migration_history_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_migration_history_events_created_at"
  ON "migration_history_events"("created_at");

CREATE INDEX IF NOT EXISTS "idx_migration_history_events_tipo"
  ON "migration_history_events"("tipo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'migration_history_events_usuario_id_fkey'
  ) THEN
    ALTER TABLE "migration_history_events"
      ADD CONSTRAINT "migration_history_events_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
