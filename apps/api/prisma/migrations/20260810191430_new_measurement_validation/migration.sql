-- AlterTable
ALTER TABLE "measurement_sheet" ADD COLUMN     "tabla_bloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "scan_records" ADD COLUMN     "excluida_del_commit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_invalido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "km_invalido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rd_invalido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "t_invalido" BOOLEAN NOT NULL DEFAULT false;
