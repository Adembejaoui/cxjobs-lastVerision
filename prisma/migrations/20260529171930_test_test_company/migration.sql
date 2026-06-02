/*
  Warnings:

  - You are about to drop the column `githubUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `jobSearchStatus` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `portfolioUrl` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `preferredLocations` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the column `willingToRelocate` on the `candidates` table. All the data in the column will be lost.
  - You are about to drop the `application_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `blogs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `company_invitations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `job_alerts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "JobRoleTarget" AS ENUM ('CALL_CENTER', 'SALES', 'TECH_SUPPORT', 'CUSTOMER_SERVICE', 'ADMIN', 'GENERAL');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT', 'FLEXIBLE', 'ROTATION');

-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('INTERNAL', 'EXTERNAL');

-- DropForeignKey
ALTER TABLE "application_messages" DROP CONSTRAINT "application_messages_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "blogs" DROP CONSTRAINT "blogs_authorId_fkey";

-- DropForeignKey
ALTER TABLE "company_invitations" DROP CONSTRAINT "company_invitations_companyId_fkey";

-- DropForeignKey
ALTER TABLE "job_alerts" DROP CONSTRAINT "job_alerts_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropIndex
DROP INDEX "applications_jobOfferId_idx";

-- AlterTable
ALTER TABLE "candidates" DROP COLUMN "githubUrl",
DROP COLUMN "jobSearchStatus",
DROP COLUMN "portfolioUrl",
DROP COLUMN "preferredLocations",
DROP COLUMN "willingToRelocate",
ADD COLUMN     "shiftType" "ShiftType",
ADD COLUMN     "targetJobRole" "JobRoleTarget" DEFAULT 'GENERAL',
ADD COLUMN     "workMode" "WorkMode";

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "applicationType" "ApplicationMethod" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "externalApplyUrl" TEXT;

-- DropTable
DROP TABLE "application_messages";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "blogs";

-- DropTable
DROP TABLE "company_invitations";

-- DropTable
DROP TABLE "job_alerts";

-- DropTable
DROP TABLE "notification_preferences";

-- DropTable
DROP TABLE "notifications";

-- CreateIndex
CREATE INDEX "applications_jobOfferId_status_idx" ON "applications"("jobOfferId", "status");

-- CreateIndex
CREATE INDEX "job_offers_companyId_status_deletedAt_idx" ON "job_offers"("companyId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "job_offers_status_createdAt_idx" ON "job_offers"("status", "createdAt");
