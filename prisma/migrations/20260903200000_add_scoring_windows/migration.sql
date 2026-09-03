CREATE TYPE "ScoringWindowMode" AS ENUM ('AUTO', 'MANUAL');

ALTER TYPE "AuditAction" ADD VALUE 'SCORING_WINDOW_UPDATE';

ALTER TABLE "Flight"
ADD COLUMN "suggestedScoringStartSeq" INTEGER,
ADD COLUMN "suggestedScoringEndSeq" INTEGER,
ADD COLUMN "scoringStartSeq" INTEGER,
ADD COLUMN "scoringEndSeq" INTEGER,
ADD COLUMN "scoringWindowMode" "ScoringWindowMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "scoringWindowReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Flight" AS flight
SET
  "suggestedScoringStartSeq" = bounds."minimumSeq",
  "suggestedScoringEndSeq" = bounds."maximumSeq",
  "scoringStartSeq" = bounds."minimumSeq",
  "scoringEndSeq" = bounds."maximumSeq"
FROM (
  SELECT "flightId", MIN("seq") AS "minimumSeq", MAX("seq") AS "maximumSeq"
  FROM "TrackPoint"
  GROUP BY "flightId"
) AS bounds
WHERE flight."id" = bounds."flightId";
