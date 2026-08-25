-- DropIndex
DROP INDEX "idx_scan_records_corregido_numero_coche";

-- AlterTable
ALTER TABLE "measurement_sheet_tecnico" ADD COLUMN     "cargo" VARCHAR(200);

-- AlterTable
ALTER TABLE "migration_history_events" ALTER COLUMN "id" DROP DEFAULT;
