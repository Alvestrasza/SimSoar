-- Add audit action for IGC downloads.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IGC_DOWNLOAD';

-- Allow per-flight public IGC download configuration.
ALTER TABLE "Flight"
ADD COLUMN "publicIgcDownloadEnabled" BOOLEAN NOT NULL DEFAULT false;
