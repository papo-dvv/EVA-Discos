UPDATE "measurement_sheet" AS ficha
SET
  "fecha_hora_inicio" = COALESCE(ficha."fecha_hora_inicio", horarios.inicio),
  "fecha_hora_fin" = COALESCE(ficha."fecha_hora_fin", horarios.fin)
FROM (
  SELECT
    f.id,
    MIN(
      (r.fecha::date + TO_TIMESTAMP(LPAD(r."meas_time_original", 6, '0'), 'HH24MISS')::time)
      AT TIME ZONE 'America/Lima'
    ) AS inicio,
    MAX(
      (r.fecha::date + TO_TIMESTAMP(LPAD(r."meas_time_original", 6, '0'), 'HH24MISS')::time)
      AT TIME ZONE 'America/Lima'
    ) AS fin
  FROM "measurement_sheet" AS f
  JOIN "scan_records" AS r ON r."file_id" = f."uploaded_file_id"
  WHERE f.motivo = 'Reperfilado'
    AND r."meas_time_original" ~ '^\d{6}$'
  GROUP BY f.id
) AS horarios
WHERE ficha.id = horarios.id;
