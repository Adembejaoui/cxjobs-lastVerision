-- DropIndex
DROP INDEX "idx_job_offers_description_trgm";

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "job_languages_language_level_jobOfferId_idx" ON "job_languages"("language", "level", "jobOfferId");
