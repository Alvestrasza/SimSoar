ALTER TYPE "AuditAction" ADD VALUE 'CUP_IMPORT';

CREATE TABLE "CupImport" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CupImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedWaypoint" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "country" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lon" DOUBLE PRECISION NOT NULL,
  "elevationM" DOUBLE PRECISION,
  "style" INTEGER,
  "description" TEXT,
  CONSTRAINT "ImportedWaypoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CupImport_ownerId_sha256_key" ON "CupImport"("ownerId", "sha256");
CREATE INDEX "CupImport_ownerId_createdAt_idx" ON "CupImport"("ownerId", "createdAt");
CREATE UNIQUE INDEX "ImportedWaypoint_importId_seq_key" ON "ImportedWaypoint"("importId", "seq");
CREATE INDEX "ImportedWaypoint_importId_seq_idx" ON "ImportedWaypoint"("importId", "seq");
CREATE INDEX "ImportedWaypoint_name_idx" ON "ImportedWaypoint"("name");
CREATE INDEX "ImportedWaypoint_code_idx" ON "ImportedWaypoint"("code");

ALTER TABLE "CupImport" ADD CONSTRAINT "CupImport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportedWaypoint" ADD CONSTRAINT "ImportedWaypoint_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CupImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
