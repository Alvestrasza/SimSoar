CREATE TYPE "HomeFeedMode" AS ENUM ('PUBLIC', 'OWN', 'FOLLOWING');

ALTER TABLE "UserPreference"
ADD COLUMN "homeFeedMode" "HomeFeedMode" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "homeFeedSimulator" TEXT,
ADD COLUMN "homeFeedCompetitionClass" TEXT;
