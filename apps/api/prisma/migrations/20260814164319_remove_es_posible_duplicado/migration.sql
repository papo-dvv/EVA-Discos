-- Elimina la posibilidad de forzar una carga duplicada (forzar=true de
-- UploadCsvDto): ese endpoint/parámetro ya no existe, así que
-- measurement_sheet.es_posible_duplicado nunca vuelve a quedar en true —
-- se elimina la columna.
ALTER TABLE "measurement_sheet" DROP COLUMN "es_posible_duplicado";
