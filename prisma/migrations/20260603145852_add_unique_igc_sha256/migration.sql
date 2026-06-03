-- Add unique constraint for IGC upload deduplication.
-- This makes duplicate upload detection cluster-safe across multiple web servers.

ALTER TABLE "Flight"
ADD CONSTRAINT "Flight_igcSha256_key" UNIQUE ("igcSha256");
