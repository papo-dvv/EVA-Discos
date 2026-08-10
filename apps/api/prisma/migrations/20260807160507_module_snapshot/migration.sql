-- CreateEnum
CREATE TYPE "ModuloSnapshot" AS ENUM ('trazabilidad', 'proyeccion');

-- CreateTable
CREATE TABLE "module_snapshot" (
    "id" UUID NOT NULL,
    "modulo" "ModuloSnapshot" NOT NULL,
    "mes_anio" VARCHAR(7) NOT NULL,
    "datos_completos" JSONB NOT NULL,
    "generado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generado_por" UUID,

    CONSTRAINT "module_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_snapshot_modulo_mes_anio_key" ON "module_snapshot"("modulo", "mes_anio");

-- AddForeignKey
ALTER TABLE "module_snapshot" ADD CONSTRAINT "module_snapshot_generado_por_fkey" FOREIGN KEY ("generado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
