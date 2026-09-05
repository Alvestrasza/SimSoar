-- Additive private pilot journal and per-user navigation placement.
ALTER TYPE "AuditAction" ADD VALUE 'JOURNAL_ENTRY_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'JOURNAL_ENTRY_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'JOURNAL_ENTRY_DELETE';

ALTER TABLE "UserPreference" ADD COLUMN "navigationSide" TEXT NOT NULL DEFAULT 'LEFT';
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_navigationSide_check" CHECK ("navigationSide" IN ('LEFT', 'RIGHT'));

CREATE TABLE "JournalEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalEntry_title_check" CHECK (char_length("title") BETWEEN 1 AND 120),
  CONSTRAINT "JournalEntry_body_check" CHECK (char_length("body") BETWEEN 1 AND 10000),
  CONSTRAINT "JournalEntry_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "JournalEntry_id_userId_key" ON "JournalEntry"("id", "userId");
CREATE INDEX "JournalEntry_userId_occurredAt_id_idx" ON "JournalEntry"("userId", "occurredAt", "id");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JournalImage" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalImage_sizeBytes_check" CHECK ("sizeBytes" BETWEEN 1 AND 5242880),
  CONSTRAINT "JournalImage_dimensions_check" CHECK ("width" BETWEEN 1 AND 8192 AND "height" BETWEEN 1 AND 8192 AND "width"::BIGINT * "height" <= 20000000)
);
CREATE UNIQUE INDEX "JournalImage_storageKey_key" ON "JournalImage"("storageKey");
CREATE INDEX "JournalImage_entryId_createdAt_idx" ON "JournalImage"("entryId", "createdAt");
CREATE INDEX "JournalImage_userId_idx" ON "JournalImage"("userId");
ALTER TABLE "JournalImage" ADD CONSTRAINT "JournalImage_entryId_userId_fkey" FOREIGN KEY ("entryId", "userId") REFERENCES "JournalEntry"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Support chronological lookups without expanding full user histories.
CREATE INDEX "FlightTask_ownerId_createdAt_id_idx" ON "FlightTask"("ownerId", "createdAt", "id");
CREATE INDEX "ClubMembership_userId_joinedAt_id_idx" ON "ClubMembership"("userId", "joinedAt", "id");
CREATE INDEX "CompetitionEntry_userId_assignedAt_id_idx" ON "CompetitionEntry"("userId", "assignedAt", "id");
CREATE INDEX "LeagueRoundEntry_userId_createdAt_id_idx" ON "LeagueRoundEntry"("userId", "createdAt", "id");
