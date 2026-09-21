-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable: add candidate demographics required by the company analytics dashboard
ALTER TABLE "candidates"
ADD COLUMN "dateOfBirth" TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN "gender" "Gender";

-- CreateIndex (used by analytics aggregation queries)
CREATE INDEX "candidates_dateOfBirth_idx" ON "candidates"("dateOfBirth");
CREATE INDEX "candidates_gender_idx" ON "candidates"("gender");
