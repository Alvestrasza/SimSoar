-- Add audit action for manually unblocking previously purged IGC hashes.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IGC_UPLOAD_UNBLOCK';
