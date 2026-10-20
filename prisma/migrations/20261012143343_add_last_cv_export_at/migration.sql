-- Add lastCvExportAt column to candidates table for CV export cooldown tracking
-- Idempotent: uses IF NOT EXISTS to handle databases where column was added via prisma db push

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'candidates'
        AND column_name = 'lastCvExportAt'
    ) THEN
        ALTER TABLE "candidates" ADD COLUMN "lastCvExportAt" TIMESTAMP(3);
    END IF;
END $$;

-- Add index for efficient cooldown queries
CREATE INDEX IF NOT EXISTS "candidates_lastCvExportAt_idx" ON "candidates"("lastCvExportAt");