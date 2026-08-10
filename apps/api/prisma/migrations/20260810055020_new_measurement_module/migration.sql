-- AlterEnum
ALTER TYPE "TipoCargaArchivo" ADD VALUE 'ficha_medicion_individual';

-- AlterTable
ALTER TABLE "scan_records" ADD COLUMN     "observacion" VARCHAR(500);

-- CreateTable
CREATE TABLE "measurement_sheet" (
    "id" UUID NOT NULL,
    "uploaded_file_id" UUID,
    "tren_numero" INTEGER NOT NULL,
    "kilometraje" DECIMAL(12,2) NOT NULL,
    "fecha_ficha" DATE NOT NULL,
    "actividad" VARCHAR(200) NOT NULL,
    "tren_original_csv" INTEGER,
    "corregido_tren" BOOLEAN NOT NULL DEFAULT false,
    "kilometraje_original_csv" DECIMAL(12,2),
    "corregido_kilometraje" BOOLEAN NOT NULL DEFAULT false,
    "todas_conformes" BOOLEAN,
    "comentarios_actividad" TEXT,
    "responsable_mantenimiento_nombre" VARCHAR(200),
    "responsable_mantenimiento_firma" VARCHAR(500),
    "responsable_mantenimiento_fecha" DATE,
    "ing_mr_nombre" VARCHAR(200),
    "ing_mr_firma" VARCHAR(500),
    "ing_mr_fecha" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_sheet_tecnico" (
    "id" UUID NOT NULL,
    "measurement_sheet_id" UUID NOT NULL,
    "posicion" INTEGER NOT NULL,
    "nombre" VARCHAR(200),
    "firma" VARCHAR(500),
    "fecha" DATE,

    CONSTRAINT "measurement_sheet_tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_sheet_instrumento" (
    "id" UUID NOT NULL,
    "measurement_sheet_id" UUID NOT NULL,
    "posicion" INTEGER NOT NULL,
    "codigo" VARCHAR(100),
    "descripcion" VARCHAR(300),
    "modelo_marca" VARCHAR(200),
    "fecha_calibracion" DATE,
    "fecha_vencimiento_calibracion" DATE,
    "observaciones" TEXT,

    CONSTRAINT "measurement_sheet_instrumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_measurement_sheet_uploaded_file" ON "measurement_sheet"("uploaded_file_id");

-- CreateIndex
CREATE INDEX "idx_measurement_sheet_tren" ON "measurement_sheet"("tren_numero");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_sheet_tecnico_measurement_sheet_id_posicion_key" ON "measurement_sheet_tecnico"("measurement_sheet_id", "posicion");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_sheet_instrumento_measurement_sheet_id_posicion_key" ON "measurement_sheet_instrumento"("measurement_sheet_id", "posicion");

-- AddForeignKey
ALTER TABLE "measurement_sheet" ADD CONSTRAINT "measurement_sheet_uploaded_file_id_fkey" FOREIGN KEY ("uploaded_file_id") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_sheet_tecnico" ADD CONSTRAINT "measurement_sheet_tecnico_measurement_sheet_id_fkey" FOREIGN KEY ("measurement_sheet_id") REFERENCES "measurement_sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_sheet_instrumento" ADD CONSTRAINT "measurement_sheet_instrumento_measurement_sheet_id_fkey" FOREIGN KEY ("measurement_sheet_id") REFERENCES "measurement_sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
