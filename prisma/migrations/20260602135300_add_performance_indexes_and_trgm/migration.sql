-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for full-text search on job offers
CREATE INDEX IF NOT EXISTS idx_job_offers_title_trgm
  ON job_offers
  USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_job_offers_description_trgm
  ON job_offers
  USING GIN (description gin_trgm_ops);

-- Composite indexes added in schema migration
CREATE INDEX IF NOT EXISTS applications_candidateId_createdAt_idx
  ON applications ("candidateId", "createdAt");

CREATE INDEX IF NOT EXISTS applications_candidateId_status_idx
  ON applications ("candidateId", "status");

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx
  ON password_reset_tokens (email);

CREATE INDEX IF NOT EXISTS email_verification_tokens_email_idx
  ON email_verification_tokens (email);

CREATE INDEX IF NOT EXISTS candidates_userId_idx
  ON candidates ("userId");

CREATE INDEX IF NOT EXISTS job_offers_deletedAt_status_createdAt_idx
  ON job_offers ("deletedAt", "status", "createdAt");

CREATE INDEX IF NOT EXISTS job_offers_companyId_deletedAt_status_createdAt_idx
  ON job_offers ("companyId", "deletedAt", "status", "createdAt");

CREATE INDEX IF NOT EXISTS users_role_isActive_idx
  ON users ("role", "isActive");
