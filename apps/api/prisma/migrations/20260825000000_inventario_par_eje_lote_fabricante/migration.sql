-- DropIndex
DROP INDEX "brake_discs_serie_key";

-- AlterTable
ALTER TABLE "brake_discs" ADD COLUMN     "fabricante" "ModeloTren",
ADD COLUMN     "lote" VARCHAR(100);

-- CreateIndex
CREATE INDEX "idx_brake_discs_serie" ON "brake_discs"("serie");

-- CreateIndex
CREATE UNIQUE INDEX "brake_discs_serie_lado_key" ON "brake_discs"("serie", "lado");
