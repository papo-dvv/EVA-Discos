-- Las firmas se almacenan como data URLs PNG y exceden con facilidad los 500
-- caracteres. TEXT preserva la firma completa para que luego pueda incrustarse
-- en la cartilla PDF.
ALTER TABLE "measurement_sheet"
  ALTER COLUMN "responsable_mantenimiento_firma" TYPE TEXT,
  ALTER COLUMN "ing_mr_firma" TYPE TEXT;

ALTER TABLE "measurement_sheet_tecnico"
  ALTER COLUMN "firma" TYPE TEXT;
