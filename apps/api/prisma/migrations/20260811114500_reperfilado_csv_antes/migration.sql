ALTER TABLE "scan_records"
  ADD COLUMN "reperfilado_t_antes" DECIMAL(6,3),
  ADD COLUMN "reperfilado_h_antes" DECIMAL(6,3),
  ADD COLUMN "reperfilado_completado" BOOLEAN NOT NULL DEFAULT false;
