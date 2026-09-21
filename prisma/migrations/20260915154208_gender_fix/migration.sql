-- DropForeignKey
ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "email_verification_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";

-- DropIndex
DROP INDEX "applications_candidateId_idx";

-- DropIndex
DROP INDEX "idx_job_offers_description_trgm";

-- DropIndex
DROP INDEX "idx_job_offers_title_trgm";

-- AlterTable
ALTER TABLE "candidates" ALTER COLUMN "preferredJobTypes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "dateOfBirth" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "applications_jobOfferId_createdAt_idx" ON "applications"("jobOfferId", "createdAt");

-- CreateIndex
CREATE INDEX "applications_createdAt_idx" ON "applications"("createdAt");

-- CreateIndex
CREATE INDEX "companies_userId_idx" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expires_idx" ON "email_verification_tokens"("expires");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "job_offers_companyId_status_createdAt_idx" ON "job_offers"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens"("expires");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "applications_candidateid_createdat_idx" RENAME TO "applications_candidateId_createdAt_idx";

-- RenameIndex
ALTER INDEX "applications_candidateid_status_idx" RENAME TO "applications_candidateId_status_idx";

-- RenameIndex
ALTER INDEX "candidates_userid_idx" RENAME TO "candidates_userId_idx";

-- RenameIndex
ALTER INDEX "job_offers_companyid_deletedat_status_createdat_idx" RENAME TO "job_offers_companyId_deletedAt_status_createdAt_idx";

-- RenameIndex
ALTER INDEX "job_offers_deletedat_status_createdat_idx" RENAME TO "job_offers_deletedAt_status_createdAt_idx";

-- RenameIndex
ALTER INDEX "users_role_isactive_idx" RENAME TO "users_role_isActive_idx";
