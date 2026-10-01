-- Add the description trigram index for case-insensitive substring search.
--
-- The index supports ILIKE '%...%' queries on JobOffer.description
-- emitted by the Candidate dashboard route (contains, mode: "insensitive").
-- A GIN index with gin_trgm_ops serves leading-wildcard ILIKE.
-- Without it, such queries seq-scan every published, non-deleted job_offers row.
--
-- Idempotent: IF NOT EXISTS guards repeat application.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_job_offers_description_trgm
  ON "job_offers" USING GIN ("description" gin_trgm_ops);