-- Add audit action for permanent flight purges.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLIGHT_PURGE';

-- Keep deleted IGC hashes blocked even after the original flight is purged.
CREATE TABLE "IgcUploadBlock" (
  "id" TEXT NOT NULL,
  "igcSha256" TEXT NOT NULL,
  "originalFlightId" TEXT,
  "originalTitle" TEXT,
  "originalPilotCallsign" TEXT,
  "reason" TEXT NOT NULL DEFAULT 'deleted-flight',
  "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedByUserId" TEXT,

  CONSTRAINT "IgcUploadBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IgcUploadBlock_igcSha256_key"
ON "IgcUploadBlock"("igcSha256");

CREATE INDEX "IgcUploadBlock_blockedAt_idx"
ON "IgcUploadBlock"("blockedAt");

CREATE INDEX "IgcUploadBlock_originalFlightId_idx"
ON "IgcUploadBlock"("originalFlightId");
