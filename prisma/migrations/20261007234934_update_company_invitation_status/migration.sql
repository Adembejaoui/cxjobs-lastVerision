/*
  Warnings:

  - You are about to drop the column `consumedBy` on the `company_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `company_invitations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CREATED', 'CLOSED');

-- DropIndex
DROP INDEX "company_invitations_createdBy_idx";

-- AlterTable
ALTER TABLE "company_invitations" DROP COLUMN "consumedBy",
DROP COLUMN "createdBy",
ADD COLUMN     "status" "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "company_invitations_status_idx" ON "company_invitations"("status");
