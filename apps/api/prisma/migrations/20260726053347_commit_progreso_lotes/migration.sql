-- AlterEnum
ALTER TYPE "EstadoArchivo" ADD VALUE 'committing';

-- AlterTable
ALTER TABLE "uploaded_files" ADD COLUMN     "commit_error" TEXT,
ADD COLUMN     "commit_lotes_completados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commit_lotes_total" INTEGER;
