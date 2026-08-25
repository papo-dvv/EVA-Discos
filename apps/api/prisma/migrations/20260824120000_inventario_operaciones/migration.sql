-- CreateEnum
CREATE TYPE "InventoryStage" AS ENUM ('almacen', 'taller', 'en_servicio');

-- CreateEnum
CREATE TYPE "FaseDisco" AS ENUM ('nueva', 'usada');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('retiro_masivo', 'cambio_disco');

-- AlterTable brake_discs: wagon_unit_id/bogie_codigo/eje_numero/lado pasan a
-- ser opcionales (una pieza en almacen/taller todavia no esta montada).
-- stage/fase se agregan con un default TEMPORAL solo para poblar las 1872
-- filas ya existentes (todas montadas hoy = en_servicio/usada); el default
-- se quita al final para que cada camino de escritura (alta de stock,
-- retiro masivo, cambio de disco, seed, migracion) lo fije explicitamente.
ALTER TABLE "brake_discs" ALTER COLUMN "wagon_unit_id" DROP NOT NULL;
ALTER TABLE "brake_discs" ALTER COLUMN "bogie_codigo" DROP NOT NULL;
ALTER TABLE "brake_discs" ALTER COLUMN "eje_numero" DROP NOT NULL;
ALTER TABLE "brake_discs" ALTER COLUMN "lado" DROP NOT NULL;
ALTER TABLE "brake_discs" ADD COLUMN "stage" "InventoryStage" NOT NULL DEFAULT 'en_servicio';
ALTER TABLE "brake_discs" ADD COLUMN "fase" "FaseDisco" NOT NULL DEFAULT 'usada';
ALTER TABLE "brake_discs" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "brake_discs" ALTER COLUMN "fase" DROP DEFAULT;
ALTER TABLE "brake_discs" ADD COLUMN "serie" VARCHAR(100);
ALTER TABLE "brake_discs" ADD COLUMN "marca_rueda" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "brake_discs_serie_key" ON "brake_discs"("serie");

-- CreateIndex
CREATE INDEX "idx_brake_discs_stage" ON "brake_discs"("stage");

-- AlterTable scan_records: flag "medicion supuesta" (ver ScanRecord.esSupuesto).
ALTER TABLE "scan_records" ADD COLUMN "es_supuesto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "brake_disc_id" UUID NOT NULL,
    "operacion_id" UUID NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "etapa_origen" "InventoryStage" NOT NULL,
    "etapa_destino" "InventoryStage" NOT NULL,
    "scan_record_id" UUID,
    "encargado_nombre" VARCHAR(200) NOT NULL,
    "encargado_firma" TEXT,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supervisor_nombre" VARCHAR(200),
    "numero_pt" VARCHAR(50),
    "justificacion" VARCHAR(500),
    "realizado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_inventory_movements_disc" ON "inventory_movements"("brake_disc_id");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_operacion" ON "inventory_movements"("operacion_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_brake_disc_id_fkey" FOREIGN KEY ("brake_disc_id") REFERENCES "brake_discs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_scan_record_id_fkey" FOREIGN KEY ("scan_record_id") REFERENCES "scan_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
