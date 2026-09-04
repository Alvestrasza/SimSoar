CREATE TYPE "AuthenticityStatus" AS ENUM ('VERIFIED', 'INCOMPLETE', 'FLAGGED', 'UNSUPPORTED');
CREATE TYPE "AuthenticityAppealStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

ALTER TYPE "AuditAction" ADD VALUE 'AUTHENTICITY_KEY_REGISTER';
ALTER TYPE "AuditAction" ADD VALUE 'AUTHENTICITY_KEY_REVOKE';
ALTER TYPE "AuditAction" ADD VALUE 'AUTHENTICITY_EVIDENCE_SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE 'AUTHENTICITY_APPEAL_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'AUTHENTICITY_APPEAL_REVIEW';

ALTER TABLE "Competition"
  ADD COLUMN "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "evidenceSimulators" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requiredEvidenceFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requireSignedEvidence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiredTaskPackageId" TEXT;

CREATE TABLE "AuthenticityKey" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "oauthClientId" TEXT NOT NULL, "keyId" TEXT NOT NULL,
  "publicKeyJwk" JSONB NOT NULL, "fingerprint" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3), CONSTRAINT "AuthenticityKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlightAuthenticitySubmission" (
  "id" TEXT NOT NULL, "flightId" TEXT NOT NULL, "userId" TEXT NOT NULL, "oauthClientId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL, "status" "AuthenticityStatus" NOT NULL, "evidenceVersion" TEXT NOT NULL,
  "evidenceSha256" TEXT NOT NULL, "simulatorVersion" TEXT, "taskPackageId" TEXT, "taskPackageSha256" TEXT,
  "attemptId" TEXT, "signed" BOOLEAN NOT NULL DEFAULT false, "signatureValid" BOOLEAN, "signingKeyId" TEXT,
  "evidenceSummary" JSONB NOT NULL, "findings" JSONB NOT NULL, "appealStatus" "AuthenticityAppealStatus",
  "appealText" TEXT, "appealedAt" TIMESTAMP(3), "appealResolution" TEXT, "appealReviewedAt" TIMESTAMP(3),
  "appealReviewedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlightAuthenticitySubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthenticityKey_userId_oauthClientId_keyId_key" ON "AuthenticityKey"("userId", "oauthClientId", "keyId");
CREATE INDEX "AuthenticityKey_oauthClientId_revokedAt_idx" ON "AuthenticityKey"("oauthClientId", "revokedAt");
CREATE INDEX "AuthenticityKey_fingerprint_idx" ON "AuthenticityKey"("fingerprint");
CREATE UNIQUE INDEX "FlightAuthenticitySubmission_flightId_revision_key" ON "FlightAuthenticitySubmission"("flightId", "revision");
CREATE INDEX "FlightAuthenticitySubmission_flightId_createdAt_idx" ON "FlightAuthenticitySubmission"("flightId", "createdAt");
CREATE INDEX "FlightAuthenticitySubmission_userId_attemptId_idx" ON "FlightAuthenticitySubmission"("userId", "attemptId");
CREATE INDEX "FlightAuthenticitySubmission_status_createdAt_idx" ON "FlightAuthenticitySubmission"("status", "createdAt");

ALTER TABLE "AuthenticityKey" ADD CONSTRAINT "AuthenticityKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthenticityKey" ADD CONSTRAINT "AuthenticityKey_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightAuthenticitySubmission" ADD CONSTRAINT "FlightAuthenticitySubmission_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightAuthenticitySubmission" ADD CONSTRAINT "FlightAuthenticitySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlightAuthenticitySubmission" ADD CONSTRAINT "FlightAuthenticitySubmission_oauthClientId_fkey" FOREIGN KEY ("oauthClientId") REFERENCES "OAuthClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlightAuthenticitySubmission" ADD CONSTRAINT "FlightAuthenticitySubmission_appealReviewedByUserId_fkey" FOREIGN KEY ("appealReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
