ALTER TYPE "AuditAction" ADD VALUE 'AIRSPACE_IMPORT';
ALTER TYPE "AuditAction" ADD VALUE 'AIRSPACE_DELETE';

CREATE TABLE "Airspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "floorLabel" TEXT NOT NULL,
    "ceilingLabel" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT NOT NULL,
    CONSTRAINT "Airspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AirspacePoint" (
    "id" TEXT NOT NULL,
    "airspaceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "AirspacePoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Airspace_active_createdAt_idx" ON "Airspace"("active", "createdAt");
CREATE UNIQUE INDEX "AirspacePoint_airspaceId_seq_key" ON "AirspacePoint"("airspaceId", "seq");
CREATE INDEX "AirspacePoint_airspaceId_seq_idx" ON "AirspacePoint"("airspaceId", "seq");
ALTER TABLE "AirspacePoint" ADD CONSTRAINT "AirspacePoint_airspaceId_fkey" FOREIGN KEY ("airspaceId") REFERENCES "Airspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
