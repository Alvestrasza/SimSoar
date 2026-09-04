CREATE TYPE "TaskVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

ALTER TYPE "AuditAction" ADD VALUE 'TASK_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'TASK_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'TASK_DELETE';

CREATE TABLE "FlightTask" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "visibility" "TaskVisibility" NOT NULL DEFAULT 'PRIVATE',
  "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlightTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskWaypoint" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "name" TEXT,
  "code" TEXT,
  "lat" DOUBLE PRECISION NOT NULL,
  "lon" DOUBLE PRECISION NOT NULL,
  "radiusM" INTEGER NOT NULL DEFAULT 500,
  CONSTRAINT "TaskWaypoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FlightTask_ownerId_updatedAt_idx" ON "FlightTask"("ownerId", "updatedAt");
CREATE INDEX "FlightTask_visibility_updatedAt_idx" ON "FlightTask"("visibility", "updatedAt");
CREATE UNIQUE INDEX "TaskWaypoint_taskId_seq_key" ON "TaskWaypoint"("taskId", "seq");
CREATE INDEX "TaskWaypoint_taskId_seq_idx" ON "TaskWaypoint"("taskId", "seq");

ALTER TABLE "FlightTask" ADD CONSTRAINT "FlightTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskWaypoint" ADD CONSTRAINT "TaskWaypoint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FlightTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
