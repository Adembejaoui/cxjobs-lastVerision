-- Re-create the description trigram index.
--
-- `20260602135300_add_performance_indexes_and_trgm` created
-- `idx_job_offers_description_trgm` (GIN, gin_trgm_ops) to support case-
-- insensitive substring matching on JobOffer.description. That index was
-- dropped by `20260915154208_gender_fix`, which was a `prisma migrate dev`
-- reconciliation: trgm indexes cannot be declared in schema.prisma, so they
-- are removed when Prisma reconciles the schema against declarations that
-- omit them.
--
-- The candidate dashboard route (`app/api/dashboard/candidate/route.ts`) emits,
-- via the Prisma PostgreSQL query compiler:
--     "description" ILIKE '%' || $skill || '%'
-- (`contains`, `mode: "insensitive"` -> ILIKE, not LOWER(...) LIKE).
-- A `pg_trgm` GIN index on `description` serves `ILIKE '%...%'` (leading
-- wildcard included). Without it this query seq-scans every published,
-- non-deleted job_offers row on every request.
--
-- Idempotent: IF NOT EXISTS guards repeat application.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_job_offers_description_trgm
  ON job_offers
  USING GIN (description gin_trgm_ops);
