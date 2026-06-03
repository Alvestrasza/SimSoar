-- Add audit action for flight metadata edits.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLIGHT_UPDATE';

-- Add weather mode metadata for editable flight details.
ALTER TABLE "Flight"
ADD COLUMN "weatherMode" TEXT NOT NULL DEFAULT 'UNKNOWN';
