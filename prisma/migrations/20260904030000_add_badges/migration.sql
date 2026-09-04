ALTER TYPE "AuditAction" ADD VALUE 'BADGE_SETTINGS_UPDATE';

CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BadgeDefinition_code_key" ON "BadgeDefinition"("code");
CREATE INDEX "BadgeDefinition_enabled_sortOrder_idx" ON "BadgeDefinition"("enabled", "sortOrder");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BadgeDefinition" ("id", "code", "name", "description", "icon", "sortOrder") VALUES
('FIRST_FLIGHT', 'FIRST_FLIGHT', 'First Flight', 'Uploaded the first approved flight.', '🛫', 10),
('DISTANCE_100', 'DISTANCE_100', '100 km', 'Completed an approved flight of at least 100 km.', '💯', 20),
('DISTANCE_300', 'DISTANCE_300', '300 km', 'Completed an approved flight of at least 300 km.', '🥉', 30),
('DISTANCE_500', 'DISTANCE_500', '500 km', 'Completed an approved flight of at least 500 km.', '🏆', 40),
('BEST_THERMAL', 'BEST_THERMAL', 'Strong Thermal', 'Recorded a thermal with at least 5 m/s maximum climb.', '🌡️', 50),
('WEEKLY_ACTIVITY', 'WEEKLY_ACTIVITY', 'Weekly Activity', 'Uploaded approved flights on three days within seven days.', '📅', 60);

-- Backfill achievements for existing approved, non-deleted flights. Runtime
-- recalculation keeps these assignments current after subsequent changes.
INSERT INTO "UserBadge" ("id", "userId", "badgeId")
SELECT md5(f."userId" || ':FIRST_FLIGHT'), f."userId", 'FIRST_FLIGHT'
FROM "Flight" f
WHERE f."moderationStatus" = 'APPROVED' AND f."deletedAt" IS NULL
GROUP BY f."userId"
ON CONFLICT ("userId", "badgeId") DO NOTHING;

INSERT INTO "UserBadge" ("id", "userId", "badgeId")
SELECT md5(f."userId" || ':' || thresholds.code), f."userId", thresholds.code
FROM "Flight" f
CROSS JOIN (VALUES
    ('DISTANCE_100', 100.0),
    ('DISTANCE_300', 300.0),
    ('DISTANCE_500', 500.0)
) AS thresholds(code, minimum_distance)
WHERE f."moderationStatus" = 'APPROVED'
  AND f."deletedAt" IS NULL
  AND f."distanceKm" >= thresholds.minimum_distance
GROUP BY f."userId", thresholds.code
ON CONFLICT ("userId", "badgeId") DO NOTHING;

INSERT INTO "UserBadge" ("id", "userId", "badgeId")
SELECT md5(f."userId" || ':BEST_THERMAL'), f."userId", 'BEST_THERMAL'
FROM "Flight" f
JOIN "Thermal" t ON t."flightId" = f."id"
WHERE f."moderationStatus" = 'APPROVED'
  AND f."deletedAt" IS NULL
  AND t."maxClimbMs" >= 5.0
GROUP BY f."userId"
ON CONFLICT ("userId", "badgeId") DO NOTHING;

INSERT INTO "UserBadge" ("id", "userId", "badgeId")
SELECT md5(f."userId" || ':WEEKLY_ACTIVITY'), f."userId", 'WEEKLY_ACTIVITY'
FROM "Flight" f
WHERE f."moderationStatus" = 'APPROVED'
  AND f."deletedAt" IS NULL
  AND f."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY f."userId"
HAVING COUNT(DISTINCT DATE(f."createdAt")) >= 3
ON CONFLICT ("userId", "badgeId") DO NOTHING;
