-- AlterTable
ALTER TABLE "companies" DROP COLUMN "industry",
DROP COLUMN "mission";

-- DropIndex
DROP INDEX IF EXISTS "companies_industry_idx";