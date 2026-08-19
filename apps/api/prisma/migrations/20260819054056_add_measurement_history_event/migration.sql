-- CreateEnum
CREATE TYPE "TipoEventoHistorialMedicion" AS ENUM ('csv_subido', 'csv_duplicado_bloqueado', 'ficha_creada_manual', 'ficha_reiniciada', 'ficha_cancelada', 'ficha_bloqueada', 'ficha_confirmada');

-- CreateTable
CREATE TABLE "measurement_history_event" (
    "id" UUID NOT NULL,
    "tipo" "TipoEventoHistorialMedicion" NOT NULL,
    "tren_numero" INTEGER NOT NULL,
    "ficha_id" UUID,
    "nombre_archivo" VARCHAR(300),
    "fecha_ficha" DATE,
    "kilometraje" DECIMAL(12,2),
    "snapshot_filas" JSONB,
    "detalle" TEXT,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_history_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_measurement_history_event_created_at" ON "measurement_history_event"("created_at");

-- CreateIndex
CREATE INDEX "idx_measurement_history_event_tren" ON "measurement_history_event"("tren_numero");

-- AddForeignKey
ALTER TABLE "measurement_history_event" ADD CONSTRAINT "measurement_history_event_ficha_id_fkey" FOREIGN KEY ("ficha_id") REFERENCES "measurement_sheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_history_event" ADD CONSTRAINT "measurement_history_event_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
