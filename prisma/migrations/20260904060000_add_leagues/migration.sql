ALTER TYPE "AuditAction" ADD VALUE 'LEAGUE_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'LEAGUE_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'LEAGUE_DELETE';

CREATE TYPE "LeagueMode" AS ENUM ('WEEKLY', 'WEEKEND');
CREATE TYPE "LeagueScope" AS ENUM ('GLOBAL', 'CLUB');
CREATE TYPE "LeagueRoundStatus" AS ENUM ('ACTIVE', 'CLOSED');

CREATE TABLE "League" (
    "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
    "mode" "LeagueMode" NOT NULL, "scope" "LeagueScope" NOT NULL DEFAULT 'GLOBAL', "clubId" TEXT,
    "startDayUtc" INTEGER NOT NULL DEFAULT 1, "startHourUtc" INTEGER NOT NULL DEFAULT 0,
    "durationHours" INTEGER NOT NULL DEFAULT 168, "scoringRule" "CompetitionScoringRule" NOT NULL DEFAULT 'OLC_POINTS',
    "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeagueRound" (
    "id" TEXT NOT NULL, "leagueId" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "LeagueRoundStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3), CONSTRAINT "LeagueRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeagueRoundEntry" (
    "id" TEXT NOT NULL, "roundId" TEXT NOT NULL, "flightId" TEXT NOT NULL, "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueRoundEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");
CREATE INDEX "League_active_mode_idx" ON "League"("active", "mode");
CREATE INDEX "League_clubId_idx" ON "League"("clubId");
CREATE UNIQUE INDEX "LeagueRound_leagueId_startsAt_key" ON "LeagueRound"("leagueId", "startsAt");
CREATE INDEX "LeagueRound_leagueId_status_startsAt_idx" ON "LeagueRound"("leagueId", "status", "startsAt");
CREATE INDEX "LeagueRound_endsAt_idx" ON "LeagueRound"("endsAt");
CREATE UNIQUE INDEX "LeagueRoundEntry_roundId_flightId_key" ON "LeagueRoundEntry"("roundId", "flightId");
CREATE INDEX "LeagueRoundEntry_roundId_score_idx" ON "LeagueRoundEntry"("roundId", "score");
CREATE INDEX "LeagueRoundEntry_roundId_userId_idx" ON "LeagueRoundEntry"("roundId", "userId");
CREATE INDEX "LeagueRoundEntry_flightId_idx" ON "LeagueRoundEntry"("flightId");
ALTER TABLE "League" ADD CONSTRAINT "League_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeagueRound" ADD CONSTRAINT "LeagueRound_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundEntry" ADD CONSTRAINT "LeagueRoundEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LeagueRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundEntry" ADD CONSTRAINT "LeagueRoundEntry_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundEntry" ADD CONSTRAINT "LeagueRoundEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
