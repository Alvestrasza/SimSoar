/*
  Warnings:

  - You are about to drop the column `realismMode` on the `Flight` table. All the data in the column will be lost.
  - You are about to drop the column `weatherMode` on the `Flight` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[flightId,seq]` on the table `Thermal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SimSoarRole" AS ENUM ('USER', 'PILOT', 'MODERATOR', 'ADMIN', 'OWNER');

-- DropIndex
DROP INDEX "Flight_createdAt_idx";

-- DropIndex
DROP INDEX "Flight_distanceKm_idx";

-- DropIndex
DROP INDEX "Flight_olcPoints_idx";

-- DropIndex
DROP INDEX "Flight_userId_idx";

-- DropIndex
DROP INDEX "Thermal_flightId_idx";

-- DropIndex
DROP INDEX "TrackPoint_flightId_idx";

-- AlterTable
ALTER TABLE "Flight" DROP COLUMN "realismMode",
DROP COLUMN "weatherMode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" "SimSoarRole"[] DEFAULT ARRAY['USER']::"SimSoarRole"[];

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "Flight_visibility_createdAt_idx" ON "Flight"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Flight_visibility_olcPoints_idx" ON "Flight"("visibility", "olcPoints");

-- CreateIndex
CREATE INDEX "Flight_userId_createdAt_idx" ON "Flight"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Thermal_flightId_seq_idx" ON "Thermal"("flightId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Thermal_flightId_seq_key" ON "Thermal"("flightId", "seq");

-- CreateIndex
CREATE INDEX "TrackPoint_flightId_seq_idx" ON "TrackPoint"("flightId", "seq");

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
