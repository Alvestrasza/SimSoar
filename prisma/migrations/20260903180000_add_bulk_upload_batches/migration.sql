CREATE TYPE "UploadBatchItemStatus" AS ENUM ('IMPORTED', 'FAILED');

CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "status" "UploadBatchItemStatus" NOT NULL,
    "errorCode" TEXT,
    "flightId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadBatch_userId_createdAt_idx" ON "UploadBatch"("userId", "createdAt");
CREATE INDEX "UploadBatchItem_batchId_createdAt_idx" ON "UploadBatchItem"("batchId", "createdAt");

ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UploadBatchItem" ADD CONSTRAINT "UploadBatchItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
