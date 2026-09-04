ALTER TABLE "Flight"
ADD COLUMN "scoringRule" TEXT NOT NULL DEFAULT 'LEGACY_DISTANCE_1_8',
ADD COLUMN "scoringDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "scoringMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
ADD COLUMN "scoringClosedCourse" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Flight"
SET "scoringDistanceKm" = "distanceKm";

CREATE TABLE "FlightScoringPoint" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "trackSeq" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "legDistanceKm" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "FlightScoringPoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightScoringPoint_flightId_order_key" ON "FlightScoringPoint"("flightId", "order");
CREATE INDEX "FlightScoringPoint_flightId_order_idx" ON "FlightScoringPoint"("flightId", "order");

ALTER TABLE "FlightScoringPoint" ADD CONSTRAINT "FlightScoringPoint_flightId_fkey"
FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
