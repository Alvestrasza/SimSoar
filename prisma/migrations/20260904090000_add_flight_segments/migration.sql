ALTER TYPE "AuditAction" ADD VALUE 'SEGMENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'SEGMENT_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'SEGMENT_DELETE';

CREATE TABLE "FlightSegment" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startLat" DOUBLE PRECISION NOT NULL,
  "startLon" DOUBLE PRECISION NOT NULL,
  "finishLat" DOUBLE PRECISION NOT NULL,
  "finishLon" DOUBLE PRECISION NOT NULL,
  "gateRadiusM" INTEGER NOT NULL DEFAULT 500,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlightSegmentResult" (
  "id" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "flightId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startSeq" INTEGER NOT NULL,
  "finishSeq" INTEGER NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlightSegmentResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightSegment_slug_key" ON "FlightSegment"("slug");
CREATE INDEX "FlightSegment_active_name_idx" ON "FlightSegment"("active", "name");
CREATE UNIQUE INDEX "FlightSegmentResult_segmentId_flightId_key" ON "FlightSegmentResult"("segmentId", "flightId");
CREATE INDEX "FlightSegmentResult_segmentId_durationSeconds_idx" ON "FlightSegmentResult"("segmentId", "durationSeconds");
CREATE INDEX "FlightSegmentResult_userId_createdAt_idx" ON "FlightSegmentResult"("userId", "createdAt");
CREATE INDEX "FlightSegmentResult_flightId_idx" ON "FlightSegmentResult"("flightId");

ALTER TABLE "FlightSegmentResult" ADD CONSTRAINT "FlightSegmentResult_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "FlightSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightSegmentResult" ADD CONSTRAINT "FlightSegmentResult_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightSegmentResult" ADD CONSTRAINT "FlightSegmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
