ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_LIKE';
ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_UNLIKE';
ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_COMMENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_COMMENT_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'FLIGHT_COMMENT_REPORT';

CREATE TABLE "FlightLike" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlightComment" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    CONSTRAINT "FlightComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlightCommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightCommentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlightLike_flightId_userId_key" ON "FlightLike"("flightId", "userId");
CREATE INDEX "FlightLike_userId_createdAt_idx" ON "FlightLike"("userId", "createdAt");
CREATE INDEX "FlightComment_flightId_createdAt_idx" ON "FlightComment"("flightId", "createdAt");
CREATE INDEX "FlightComment_userId_createdAt_idx" ON "FlightComment"("userId", "createdAt");
CREATE INDEX "FlightComment_deletedAt_idx" ON "FlightComment"("deletedAt");
CREATE UNIQUE INDEX "FlightCommentReport_commentId_reporterId_key" ON "FlightCommentReport"("commentId", "reporterId");
CREATE INDEX "FlightCommentReport_createdAt_idx" ON "FlightCommentReport"("createdAt");

ALTER TABLE "FlightLike" ADD CONSTRAINT "FlightLike_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightLike" ADD CONSTRAINT "FlightLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightComment" ADD CONSTRAINT "FlightComment_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightComment" ADD CONSTRAINT "FlightComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightCommentReport" ADD CONSTRAINT "FlightCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "FlightComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightCommentReport" ADD CONSTRAINT "FlightCommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
