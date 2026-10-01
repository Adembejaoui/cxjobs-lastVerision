-- Add the composite index required by the Candidate workload.
--
-- `schema.prisma` declares:
--   @@index([candidateId, status, isSaved])
-- on the Application model, but no migration had ever created it.
-- The existing `applications_candidateId_status_idx` covers only the
-- first two columns; the `isSaved` column is not indexed, so queries that
-- filter by `isSaved` (e.g. the Candidate dashboard saved-jobs count in
-- `app/(dashboard)/dashboard/candidate/page.tsx`) cannot use this index.
--
-- Idempotent: IF NOT EXISTS guards repeat application.
-- The index name is quoted to preserve the mixed-case spelling that
-- Prisma generates for @@index([candidateId, status, isSaved]); without
-- quotes PostgreSQL folds it to lowercase and the name no longer matches
-- the schema declaration.
CREATE INDEX IF NOT EXISTS "applications_candidateId_status_isSaved_idx"
  ON applications ("candidateId", "status", "isSaved");