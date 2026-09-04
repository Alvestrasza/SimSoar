-- Version task lineage and count package downloads without storing downloader identities.
ALTER TABLE "FlightTask"
  ADD COLUMN "lineageId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "packageDownloads" INTEGER NOT NULL DEFAULT 0;

UPDATE "FlightTask" SET "lineageId" = "id" WHERE "lineageId" IS NULL;
ALTER TABLE "FlightTask" ALTER COLUMN "lineageId" SET NOT NULL;

CREATE INDEX "FlightTask_lineageId_revision_idx" ON "FlightTask"("lineageId", "revision");
