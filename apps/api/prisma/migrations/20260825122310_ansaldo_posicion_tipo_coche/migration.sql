-- Soporte Ansaldo: posición del disco (interior/exterior), tipos de coche
-- M20/M21/M22, y pseudo-tren 0 (Reserva).

-- CreateEnum
CREATE TYPE "PosicionDisco" AS ENUM ('unica', 'interior', 'exterior');

-- AlterEnum
ALTER TYPE "TipoCoche" ADD VALUE 'M20';
ALTER TYPE "TipoCoche" ADD VALUE 'M21';
ALTER TYPE "TipoCoche" ADD VALUE 'M22';

-- DropIndex
DROP INDEX "brake_discs_wagon_unit_id_bogie_codigo_eje_numero_lado_key";

-- AlterTable
ALTER TABLE "brake_discs" ADD COLUMN     "posicion" "PosicionDisco" NOT NULL DEFAULT 'unica';

-- CreateIndex
CREATE UNIQUE INDEX "brake_discs_wagon_unit_id_bogie_codigo_eje_numero_lado_posi_key" ON "brake_discs"("wagon_unit_id", "bogie_codigo", "eje_numero", "lado", "posicion");

-- Relaja chk_train_numero para admitir el pseudo-tren 0 (Reserva: unidades
-- Ansaldo sin tren real asignado, ver hoja "UDT RESERVA" en migration-excel.parser.ts).
ALTER TABLE "trains" DROP CONSTRAINT "chk_train_numero";
ALTER TABLE "trains" ADD CONSTRAINT "chk_train_numero" CHECK (numero BETWEEN 0 AND 44);
