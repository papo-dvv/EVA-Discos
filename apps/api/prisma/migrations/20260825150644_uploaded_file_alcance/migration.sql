-- Alcance declarado por el usuario al subir una migración (ver
-- UploadMigracionDto) — persistido para que el commit/cancelación posterior
-- reporten el mismo alcance que la subida original.

-- AlterTable
ALTER TABLE "uploaded_files" ADD COLUMN     "alcance" VARCHAR(40),
ADD COLUMN     "marca" VARCHAR(20),
ADD COLUMN     "tren_numero" INTEGER;
