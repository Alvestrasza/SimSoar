-- Initial SimSoar schema: Auth.js, pilot profiles, IGC flights, track points and thermals.
CREATE TYPE "FlightVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId", "credentialID")
);

CREATE TABLE "PilotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "homeAirfield" TEXT,
    "favoriteSim" TEXT,
    "favoriteGlider" TEXT,
    "country" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PilotProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pilotCallsign" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "simulator" TEXT NOT NULL,
    "glider" TEXT,
    "registration" TEXT,
    "competitionClass" TEXT,
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

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");
CREATE UNIQUE INDEX "PilotProfile_userId_key" ON "PilotProfile"("userId");
CREATE INDEX "PilotProfile_callsign_idx" ON "PilotProfile"("callsign");
CREATE INDEX "Flight_visibility_createdAt_idx" ON "Flight"("visibility", "createdAt");
CREATE INDEX "Flight_visibility_olcPoints_idx" ON "Flight"("visibility", "olcPoints");
CREATE INDEX "Flight_userId_createdAt_idx" ON "Flight"("userId", "createdAt");
CREATE UNIQUE INDEX "TrackPoint_flightId_seq_key" ON "TrackPoint"("flightId", "seq");
CREATE INDEX "TrackPoint_flightId_seq_idx" ON "TrackPoint"("flightId", "seq");
CREATE UNIQUE INDEX "Thermal_flightId_seq_key" ON "Thermal"("flightId", "seq");
CREATE INDEX "Thermal_flightId_seq_idx" ON "Thermal"("flightId", "seq");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotProfile" ADD CONSTRAINT "PilotProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackPoint" ADD CONSTRAINT "TrackPoint_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Thermal" ADD CONSTRAINT "Thermal_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
