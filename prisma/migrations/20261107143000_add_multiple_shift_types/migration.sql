-- AlterTable: support multiple shift types per candidate
-- Converts the existing scalar `shiftType` column into a `ShiftType[]` array,
-- preserving any already-selected single value as a one-element array.
ALTER TABLE "candidates"
ALTER COLUMN "shiftType" SET DATA TYPE "ShiftType"[]
  USING CASE
    WHEN "shiftType" IS NOT NULL THEN ARRAY["shiftType"]
    ELSE '{}'::"ShiftType"[]
  END,
ALTER COLUMN "shiftType" SET DEFAULT '{}'::"ShiftType"[];
