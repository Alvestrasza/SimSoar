-- Add audit actions for restoring soft-deleted flights and replacing IGC files.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLIGHT_RESTORE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FLIGHT_IGC_REPLACE';
