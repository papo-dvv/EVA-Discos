/*
  Warnings:

  - Added the required column `bogie_codigo` to the `wear_rate_pairs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eje_numero` to the `wear_rate_pairs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lado` to the `wear_rate_pairs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero_coche` to the `wear_rate_pairs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo_coche` to the `wear_rate_pairs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "wear_rate_pairs" ADD COLUMN     "bogie_codigo" VARCHAR(10) NOT NULL,
ADD COLUMN     "eje_numero" INTEGER NOT NULL,
ADD COLUMN     "lado" "LadoDisco" NOT NULL,
ADD COLUMN     "numero_coche" INTEGER NOT NULL,
ADD COLUMN     "tipo_coche" "TipoCoche" NOT NULL;

-- CreateIndex
CREATE INDEX "idx_wear_rate_pairs_tren_bogie" ON "wear_rate_pairs"("tren_numero", "bogie_codigo");

-- CreateIndex
CREATE INDEX "idx_wear_rate_pairs_eje" ON "wear_rate_pairs"("eje_numero");
