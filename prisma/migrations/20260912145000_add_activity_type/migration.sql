-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CUSTOMER_SERVICE', 'SALES_LEAD_GENERATION', 'TECHNICAL_IT_SUPPORT', 'DEBT_COLLECTION_LITIGATION', 'BACK_OFFICE_DIGITAL_SERVICES', 'SURVEYS_MARKET_RESEARCH', 'OTHER');

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "activityType" "ActivityType" NOT NULL DEFAULT 'CUSTOMER_SERVICE',
ADD COLUMN     "activityCustom" TEXT;

-- CreateIndex
CREATE INDEX "job_offers_activityType_idx" ON "job_offers"("activityType");