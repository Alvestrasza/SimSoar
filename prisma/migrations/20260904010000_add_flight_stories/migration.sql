ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_STORY_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_STORY_IMAGE_DELETE';

ALTER TABLE "Flight" ADD COLUMN "storyText" TEXT;

CREATE TABLE "FlightStoryImage" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT NOT NULL,
    CONSTRAINT "FlightStoryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightStoryImage_flightId_sha256_key" ON "FlightStoryImage"("flightId", "sha256");
CREATE INDEX "FlightStoryImage_flightId_createdAt_idx" ON "FlightStoryImage"("flightId", "createdAt");
ALTER TABLE "FlightStoryImage" ADD CONSTRAINT "FlightStoryImage_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
