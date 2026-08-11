ALTER TABLE "measurement_sheet"
  ADD COLUMN "motivo" VARCHAR(100) NOT NULL DEFAULT 'Medición',
  ADD COLUMN "puesto_trabajo" VARCHAR(100),
  ADD COLUMN "fecha_hora_inicio" TIMESTAMPTZ(6),
  ADD COLUMN "fecha_hora_fin" TIMESTAMPTZ(6);

ALTER TABLE "scan_records"
  ADD COLUMN "rugosidad_ra" DECIMAL(6,3);
