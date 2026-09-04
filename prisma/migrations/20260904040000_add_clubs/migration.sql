ALTER TYPE "AuditAction" ADD VALUE 'CLUB_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'CLUB_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'CLUB_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'CLUB_MEMBER_ASSIGN';
ALTER TYPE "AuditAction" ADD VALUE 'CLUB_MEMBER_REMOVE';

CREATE TYPE "ClubMemberRole" AS ENUM ('MEMBER', 'MANAGER');

CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClubMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
CREATE INDEX "Club_name_idx" ON "Club"("name");
CREATE UNIQUE INDEX "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");
CREATE INDEX "ClubMembership_clubId_role_idx" ON "ClubMembership"("clubId", "role");
CREATE INDEX "ClubMembership_userId_idx" ON "ClubMembership"("userId");
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
