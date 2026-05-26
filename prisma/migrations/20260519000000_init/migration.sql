-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FlightVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PilotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "homeAirfield" TEXT,
    "country" TEXT,
    "favoriteSim" TEXT,
    "favoriteGlider" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pilotCallsign" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "simulator" TEXT NOT NULL,
    "glider" TEXT,
    "registration" TEXT,
    "competitionClass" TEXT,
    "weatherMode" TEXT,
    "realismMode" TEXT,
    "comment" TEXT,
    "visibility" "FlightVisibility" NOT NULL DEFAULT 'PUBLIC',
    "igcObjectPath" TEXT NOT NULL,
    "igcSha256" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "olcPoints" DOUBLE PRECISION NOT NULL,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL,
    "maxAltitudeM" INTEGER NOT NULL,
    "minAltitudeM" INTEGER NOT NULL,
    "maxVarioMs" DOUBLE PRECISION NOT NULL,
    "startLat" DOUBLE PRECISION,
    "startLon" DOUBLE PRECISION,
    "finishLat" DOUBLE PRECISION,
    "finishLon" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackPoint" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "time" TIMESTAMP(3),
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "altM" INTEGER NOT NULL,
    "varioMs" DOUBLE PRECISION,

    CONSTRAINT "TrackPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thermal" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "centerLat" DOUBLE PRECISION,
    "centerLon" DOUBLE PRECISION,
    "avgClimbMs" DOUBLE PRECISION NOT NULL,
    "maxClimbMs" DOUBLE PRECISION NOT NULL,
    "gainM" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,

    CONSTRAINT "Thermal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_userId_key" ON "PilotProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PilotProfile_callsign_key" ON "PilotProfile"("callsign");

-- CreateIndex
CREATE INDEX "Flight_createdAt_idx" ON "Flight"("createdAt");

-- CreateIndex
CREATE INDEX "Flight_olcPoints_idx" ON "Flight"("olcPoints");

-- CreateIndex
CREATE INDEX "Flight_distanceKm_idx" ON "Flight"("distanceKm");

-- CreateIndex
CREATE INDEX "Flight_userId_idx" ON "Flight"("userId");

-- CreateIndex
CREATE INDEX "TrackPoint_flightId_idx" ON "TrackPoint"("flightId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackPoint_flightId_seq_key" ON "TrackPoint"("flightId", "seq");

-- CreateIndex
CREATE INDEX "Thermal_flightId_idx" ON "Thermal"("flightId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotProfile" ADD CONSTRAINT "PilotProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackPoint" ADD CONSTRAINT "TrackPoint_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thermal" ADD CONSTRAINT "Thermal_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

