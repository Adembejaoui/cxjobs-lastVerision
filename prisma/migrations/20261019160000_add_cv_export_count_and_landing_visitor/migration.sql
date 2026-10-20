-- Add cvExportCount column to candidates table for CV export tracking
ALTER TABLE "candidates" ADD COLUMN "cvExportCount" INTEGER NOT NULL DEFAULT 0;

-- Create landing_page_visitors table for unique visitor tracking
CREATE TABLE "landing_page_visitors" (
    "id" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_visitors_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on visitorHash
CREATE UNIQUE INDEX "landing_page_visitors_visitorHash_key" ON "landing_page_visitors"("visitorHash");

-- Create index on firstSeenAt for efficient counting
CREATE INDEX "landing_page_visitors_firstSeenAt_idx" ON "landing_page_visitors"("firstSeenAt");