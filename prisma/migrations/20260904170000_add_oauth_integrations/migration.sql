CREATE TYPE "OAuthClientStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REVOKED');

ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CLIENT_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CLIENT_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_CLIENT_REVOKE';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_GRANT_USE';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_GRANT_REVOKE';
ALTER TYPE "AuditAction" ADD VALUE 'OAUTH_API_WRITE';

CREATE TABLE "OAuthClient" (
  "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "redirectUris" TEXT[] NOT NULL, "allowedScopes" TEXT[] NOT NULL, "status" "OAuthClientStatus" NOT NULL DEFAULT 'PENDING',
  "consentRequired" BOOLEAN NOT NULL DEFAULT true, "registeredByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OAuthGrant" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "oauthClientId" TEXT NOT NULL, "scopes" TEXT[] NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3), CONSTRAINT "OAuthGrant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OAuthIdempotencyRecord" (
  "id" TEXT NOT NULL, "oauthClientId" TEXT NOT NULL, "userId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "responseStatus" INTEGER NOT NULL, "responseBody" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OAuthIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");
CREATE INDEX "OAuthClient_status_name_idx" ON "OAuthClient"("status", "name");
CREATE UNIQUE INDEX "OAuthGrant_userId_oauthClientId_key" ON "OAuthGrant"("userId", "oauthClientId");
CREATE INDEX "OAuthGrant_userId_revokedAt_idx" ON "OAuthGrant"("userId", "revokedAt");
CREATE INDEX "OAuthGrant_oauthClientId_revokedAt_idx" ON "OAuthGrant"("oauthClientId", "revokedAt");
CREATE UNIQUE INDEX "OAuthIdempotencyRecord_oauthClientId_userId_key_key" ON "OAuthIdempotencyRecord"("oauthClientId", "userId", "key");
CREATE INDEX "OAuthIdempotencyRecord_expiresAt_idx" ON "OAuthIdempotencyRecord"("expiresAt");

ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OAuthGrant" ADD CONSTRAINT "OAuthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAuthGrant" ADD CONSTRAINT "OAuthGrant_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAuthIdempotencyRecord" ADD CONSTRAINT "OAuthIdempotencyRecord_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAuthIdempotencyRecord" ADD CONSTRAINT "OAuthIdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
