ALTER TABLE "measurement_sheet"
  ADD COLUMN "source_measurement_sheet_id" UUID;

CREATE UNIQUE INDEX "measurement_sheet_source_measurement_sheet_id_key"
  ON "measurement_sheet"("source_measurement_sheet_id");
