CREATE TABLE "GlidePhase" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startSeq" INTEGER NOT NULL,
    "endSeq" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL,
    "avgSinkMs" DOUBLE PRECISION NOT NULL,
    "glideRatio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GlidePhase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlidePhase_flightId_seq_key" ON "GlidePhase"("flightId", "seq");
CREATE INDEX "GlidePhase_flightId_seq_idx" ON "GlidePhase"("flightId", "seq");

ALTER TABLE "GlidePhase" ADD CONSTRAINT "GlidePhase_flightId_fkey"
FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
