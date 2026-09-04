ALTER TABLE "Airspace"
ADD COLUMN "minLat" DOUBLE PRECISION,
ADD COLUMN "maxLat" DOUBLE PRECISION,
ADD COLUMN "minLon" DOUBLE PRECISION,
ADD COLUMN "maxLon" DOUBLE PRECISION;

UPDATE "Airspace" AS airspace
SET
    "minLat" = bounds."minLat",
    "maxLat" = bounds."maxLat",
    "minLon" = bounds."minLon",
    "maxLon" = bounds."maxLon"
FROM (
    SELECT
        "airspaceId",
        MIN("lat") AS "minLat",
        MAX("lat") AS "maxLat",
        MIN("lon") AS "minLon",
        MAX("lon") AS "maxLon"
    FROM "AirspacePoint"
    GROUP BY "airspaceId"
) AS bounds
WHERE airspace."id" = bounds."airspaceId";

ALTER TABLE "Airspace"
ALTER COLUMN "minLat" SET NOT NULL,
ALTER COLUMN "maxLat" SET NOT NULL,
ALTER COLUMN "minLon" SET NOT NULL,
ALTER COLUMN "maxLon" SET NOT NULL;

CREATE INDEX "Airspace_active_minLat_maxLat_idx" ON "Airspace"("active", "minLat", "maxLat");
CREATE INDEX "Airspace_active_minLon_maxLon_idx" ON "Airspace"("active", "minLon", "maxLon");
