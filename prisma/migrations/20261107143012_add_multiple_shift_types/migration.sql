/*
  Warnings:

  - Changed the column `shiftType` on the `candidates` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterTable
ALTER TABLE "candidates" ALTER COLUMN "shiftType" SET DEFAULT ARRAY[]::"ShiftType"[],
ALTER COLUMN "shiftType" SET DATA TYPE "ShiftType"[];

-- CreateIndex
CREATE INDEX "candidates_lastCvExportAt_idx" ON "candidates"("lastCvExportAt");
