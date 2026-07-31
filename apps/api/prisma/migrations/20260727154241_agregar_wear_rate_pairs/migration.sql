-- CreateTable
CREATE TABLE "wear_rate_pairs" (
    "id" UUID NOT NULL,
    "disc_id" UUID NOT NULL,
    "scan_record_id_1" UUID NOT NULL,
    "scan_record_id_2" UUID NOT NULL,
    "tren_numero" INTEGER NOT NULL,
    "fecha_1" DATE NOT NULL,
    "km_1" DECIMAL(12,2) NOT NULL,
    "rd_1" DOUBLE PRECISION NOT NULL,
    "fecha_2" DATE NOT NULL,
    "km_2" DECIMAL(12,2) NOT NULL,
    "rd_2" DOUBLE PRECISION NOT NULL,
    "motivo_2" VARCHAR(100) NOT NULL,
    "diferencia_km" DECIMAL(12,2) NOT NULL,
    "diferencia_rd" DOUBLE PRECISION NOT NULL,
    "tasa" DECIMAL(20,12) NOT NULL,
    "km_mensual_usado" DECIMAL(12,2) NOT NULL,
    "tasa_mensual" DECIMAL(20,12) NOT NULL,
    "comentario" TEXT NOT NULL,
    "es_valido" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wear_rate_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_wear_rate_pairs_disc_fecha1" ON "wear_rate_pairs"("disc_id", "fecha_1");

-- CreateIndex
CREATE INDEX "idx_wear_rate_pairs_tren" ON "wear_rate_pairs"("tren_numero");

-- CreateIndex
CREATE UNIQUE INDEX "wear_rate_pairs_scan_record_id_1_scan_record_id_2_key" ON "wear_rate_pairs"("scan_record_id_1", "scan_record_id_2");

-- AddForeignKey
ALTER TABLE "wear_rate_pairs" ADD CONSTRAINT "wear_rate_pairs_disc_id_fkey" FOREIGN KEY ("disc_id") REFERENCES "brake_discs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wear_rate_pairs" ADD CONSTRAINT "wear_rate_pairs_scan_record_id_1_fkey" FOREIGN KEY ("scan_record_id_1") REFERENCES "scan_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wear_rate_pairs" ADD CONSTRAINT "wear_rate_pairs_scan_record_id_2_fkey" FOREIGN KEY ("scan_record_id_2") REFERENCES "scan_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
