CREATE TYPE "UnitSystemPreference" AS ENUM ('METRIC', 'IMPERIAL');

CREATE TYPE "LeaderboardViewPreference" AS ENUM ('ALL', 'MSFS', 'CONDOR', 'XPLANE');

CREATE TYPE "MapModePreference" AS ENUM ('STANDARD', 'SATELLITE', 'TERRAIN');

ALTER TABLE "UserPreference"
ADD COLUMN "preferredSimulator" TEXT NOT NULL DEFAULT 'MSFS 2024',
ADD COLUMN "unitSystem" "UnitSystemPreference" NOT NULL DEFAULT 'METRIC',
ADD COLUMN "preferredLeaderboardView" "LeaderboardViewPreference" NOT NULL DEFAULT 'ALL',
ADD COLUMN "preferredMapMode" "MapModePreference" NOT NULL DEFAULT 'STANDARD';
