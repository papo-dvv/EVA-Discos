ALTER TABLE "scan_records"
  ADD COLUMN "meas_point_name_original" VARCHAR(100),
  ADD COLUMN "meas_time_original" VARCHAR(20),
  ADD COLUMN "profile_link_original" TEXT;
