ALTER TABLE "scan_records"
  ADD COLUMN IF NOT EXISTS "numero_coche_original_excel" INTEGER,
  ADD COLUMN IF NOT EXISTS "corregido_numero_coche" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_scan_records_corregido_numero_coche"
  ON "scan_records"("corregido_numero_coche");
