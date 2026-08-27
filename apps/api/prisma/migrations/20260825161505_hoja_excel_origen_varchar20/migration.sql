-- "UDT RESERVA" (hoja de reserva Ansaldo) tiene 12 caracteres, más largo que
-- cualquier "T\d\d" — VarChar(10) se quedaba corto y rompía la migración
-- masiva con LengthMismatch.

-- AlterTable
ALTER TABLE "scan_records" ALTER COLUMN "hoja_excel_origen" SET DATA TYPE VARCHAR(20);
