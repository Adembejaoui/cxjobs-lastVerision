-- Restore the trigram (pg_trgm) GIN indexes used by case-insensitive
-- substring search.
--
-- WHY THIS MIGRATION EXISTS
-- Prisma compiles `contains` + `mode: "insensitive"` to ILIKE '%…%', which a
-- B-tree index cannot serve. Trigram GIN indexes were created by
-- 20260602135300_add_performance_indexes_and_trgm (title, description) and
-- re-created by 20260928140000 / 20260928184500 (description), but every one of
-- them was later DROPPED by `prisma migrate dev` reconciliations
-- (20260915154208_gender_fix, 20260928181412_add_job_offer_closed_at,
-- 20261001163809_fix_error_gender), because they were not declared in
-- schema.prisma. The final migration state therefore had NO trigram index.
--
-- These indexes are now declared in schema.prisma (`type: Gin`,
-- `ops: raw("gin_trgm_ops")`, same `map:` names), so future `migrate dev` runs
-- see them as intended rather than as drift. The statements below are exactly
-- what `prisma migrate diff` emits for those declarations, plus IF NOT EXISTS
-- guards (a database may still hold some of them from older migrations).
--
-- Queries served (all `contains` + `mode: "insensitive"`):
--   job_offers.title, job_offers.description   -> lib/job-offers-utils.ts (search),
--                                                app/api/dashboard/candidate/route.ts (description)
--   job_offers.customLocation, companies.location -> lib/job-offers-utils.ts (location)
--   companies.name                              -> lib/job-offers-utils.ts (search)
--
-- OPERATIONAL NOTE
-- Plain CREATE INDEX (not CONCURRENTLY: Prisma runs a migration file as one
-- script, and CONCURRENTLY cannot run inside a transaction block). It takes a
-- SHARE lock that blocks writes to job_offers/companies while each index
-- builds; on the current table sizes this is seconds. For a very large table,
-- create the indexes CONCURRENTLY by hand beforehand; the IF NOT EXISTS guards
-- then make this migration a no-op.
--
-- Forward-only and additive: no data is modified, no existing object dropped.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_job_offers_title_trgm" ON "job_offers" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_job_offers_description_trgm" ON "job_offers" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_job_offers_custom_location_trgm" ON "job_offers" USING GIN ("customLocation" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_companies_name_trgm" ON "companies" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_companies_location_trgm" ON "companies" USING GIN ("location" gin_trgm_ops);
