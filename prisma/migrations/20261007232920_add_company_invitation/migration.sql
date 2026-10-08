-- CreateTable
CREATE TABLE "company_invitations" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "managerName" TEXT,
    "managerEmail" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "consumedBy" TEXT,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_tokenHash_key" ON "company_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "company_invitations_companyEmail_idx" ON "company_invitations"("companyEmail");

-- CreateIndex
CREATE INDEX "company_invitations_createdBy_idx" ON "company_invitations"("createdBy");

-- CreateIndex
CREATE INDEX "company_invitations_expiresAt_idx" ON "company_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "company_invitations_createdAt_idx" ON "company_invitations"("createdAt");
