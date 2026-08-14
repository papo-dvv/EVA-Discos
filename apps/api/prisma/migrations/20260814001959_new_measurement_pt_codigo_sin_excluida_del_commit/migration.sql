-- AlterTable
ALTER TABLE "measurement_sheet" ADD COLUMN     "pt_codigo" VARCHAR(100);

-- AlterTable
ALTER TABLE "scan_records" DROP COLUMN "excluida_del_commit";

