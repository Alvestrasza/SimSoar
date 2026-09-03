ALTER TYPE "AuditAction" ADD VALUE 'PILOT_FOLLOW';
ALTER TYPE "AuditAction" ADD VALUE 'PILOT_UNFOLLOW';

CREATE TABLE "PilotFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PilotFollow_followerId_followingId_key"
ON "PilotFollow"("followerId", "followingId");

CREATE INDEX "PilotFollow_followingId_createdAt_idx"
ON "PilotFollow"("followingId", "createdAt");

CREATE INDEX "PilotFollow_followerId_createdAt_idx"
ON "PilotFollow"("followerId", "createdAt");

ALTER TABLE "PilotFollow"
ADD CONSTRAINT "PilotFollow_followerId_fkey"
FOREIGN KEY ("followerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotFollow"
ADD CONSTRAINT "PilotFollow_followingId_fkey"
FOREIGN KEY ("followingId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PilotFollow"
ADD CONSTRAINT "PilotFollow_no_self_follow_check"
CHECK ("followerId" <> "followingId");
