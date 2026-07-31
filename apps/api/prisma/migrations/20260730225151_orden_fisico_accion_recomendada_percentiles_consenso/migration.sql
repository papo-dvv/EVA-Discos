-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'consenso_extremo_ajustado';

-- AlterTable
ALTER TABLE "scan_records" ADD COLUMN     "orden_fisico" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "wear_rate_pairs" ADD COLUMN     "orden_fisico" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_scan_records_orden_fisico" ON "scan_records"("tren_numero", "orden_fisico");

-- CreateIndex
CREATE INDEX "idx_wear_rate_pairs_orden_fisico" ON "wear_rate_pairs"("tren_numero", "orden_fisico");
