-- Ansaldo: interior y exterior del mismo lado comparten serie (mismo eje),
-- así que serie+lado ya no identifica un único disco.

-- DropIndex
DROP INDEX "brake_discs_serie_lado_key";

-- CreateIndex
CREATE UNIQUE INDEX "brake_discs_serie_lado_posicion_key" ON "brake_discs"("serie", "lado", "posicion");
