-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterEnum: reconfigure ContractType to contain exactly CDI, CIVP, KARAMA, FREELANCE
BEGIN;
CREATE TYPE "ContractType_new" AS ENUM ('CDI', 'CIVP', 'KARAMA', 'FREELANCE');
ALTER TABLE "job_offers" ALTER COLUMN "contractType" DROP DEFAULT;
ALTER TABLE "job_offers" ALTER COLUMN "contractType" TYPE "ContractType_new" USING (
  CASE "contractType"::text
    WHEN 'CDI' THEN 'CDI'
    WHEN 'CIVP' THEN 'CIVP'
    WHEN 'KARAMA' THEN 'KARAMA'
    WHEN 'FREELANCE' THEN 'FREELANCE'
    WHEN 'CDD' THEN 'CIVP'
    WHEN 'INTERNSHIP' THEN 'CIVP'
    WHEN 'APPRENTICESHIP' THEN 'CIVP'
    WHEN 'PART_TIME' THEN 'CDI'
    ELSE 'CDI'
  END::"ContractType_new"
);
ALTER TYPE "ContractType" RENAME TO "ContractType_old";
ALTER TYPE "ContractType_new" RENAME TO "ContractType";
DROP TYPE "ContractType_old";
ALTER TABLE "job_offers" ALTER COLUMN "contractType" SET DEFAULT 'CDI';
COMMIT;

-- AlterTable
ALTER TABLE "job_offers"
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME';

-- DropIndex
DROP INDEX "job_offers_experienceLevel_idx";

-- AlterTable
ALTER TABLE "job_offers"
DROP COLUMN     "experienceLevel";

-- DropEnum (safe: ExperienceLevel is no longer referenced after dropping the column above)
DROP TYPE "ExperienceLevel";

-- CreateIndex
CREATE INDEX "job_offers_employmentType_idx" ON "job_offers"("employmentType");
