-- AlterTable
ALTER TABLE "scan_records" ADD COLUMN     "bogie_excel" VARCHAR(10),
ADD COLUMN     "coche_excel" VARCHAR(10),
ADD COLUMN     "eje_excel" INTEGER,
ADD COLUMN     "numero_coche_excel" INTEGER,
ADD COLUMN     "rueda_excel" INTEGER,
ADD COLUMN     "ubicacion_excel" VARCHAR(20);
