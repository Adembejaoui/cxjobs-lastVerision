-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "softSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "technicalTools" TEXT[] DEFAULT ARRAY[]::TEXT[];
