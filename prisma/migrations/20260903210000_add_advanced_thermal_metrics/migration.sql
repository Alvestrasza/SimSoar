ALTER TABLE "Thermal"
ADD COLUMN "startSeq" INTEGER,
ADD COLUMN "endSeq" INTEGER,
ADD COLUMN "efficiencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Thermal"
SET "efficiencyPercent" = CASE
  WHEN "maxClimbMs" > 0 THEN LEAST(100, GREATEST(0, "avgClimbMs" / "maxClimbMs" * 100))
  ELSE 0
END;
