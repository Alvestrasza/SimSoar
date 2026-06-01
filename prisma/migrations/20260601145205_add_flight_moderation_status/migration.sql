-- CreateEnum
CREATE TYPE "FlightModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

-- DropIndex
DROP INDEX "Flight_visibility_olcPoints_idx";

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedByUserId" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedByUserId" TEXT,
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderationStatus" "FlightModerationStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "Flight_visibility_moderationStatus_createdAt_idx" ON "Flight"("visibility", "moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Flight_visibility_moderationStatus_olcPoints_idx" ON "Flight"("visibility", "moderationStatus", "olcPoints");

-- CreateIndex
CREATE INDEX "Flight_moderationStatus_createdAt_idx" ON "Flight"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Flight_deletedAt_idx" ON "Flight"("deletedAt");
