ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_CLOSE';
ALTER TYPE "AuditAction" ADD VALUE 'COMPETITION_DELETE';

CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "CompetitionScoringRule" AS ENUM ('OLC_POINTS', 'DISTANCE');

CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "scoringRule" "CompetitionScoringRule" NOT NULL DEFAULT 'OLC_POINTS',
    "simulator" TEXT,
    "competitionClass" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetitionEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");
CREATE INDEX "Competition_status_startAt_endAt_idx" ON "Competition"("status", "startAt", "endAt");
CREATE INDEX "Competition_endAt_idx" ON "Competition"("endAt");
CREATE UNIQUE INDEX "CompetitionEntry_competitionId_flightId_key" ON "CompetitionEntry"("competitionId", "flightId");
CREATE INDEX "CompetitionEntry_competitionId_score_idx" ON "CompetitionEntry"("competitionId", "score");
CREATE INDEX "CompetitionEntry_competitionId_userId_idx" ON "CompetitionEntry"("competitionId", "userId");
CREATE INDEX "CompetitionEntry_flightId_idx" ON "CompetitionEntry"("flightId");
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
