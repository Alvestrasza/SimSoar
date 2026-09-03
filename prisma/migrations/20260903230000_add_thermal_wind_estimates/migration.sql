CREATE TYPE "WindEstimateConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Thermal"
ADD COLUMN "windDirectionDeg" INTEGER,
ADD COLUMN "windSpeedKmh" DOUBLE PRECISION,
ADD COLUMN "windConfidence" "WindEstimateConfidence",
ADD COLUMN "windDriftDistanceM" INTEGER;
