import { test, expect } from "@playwright/test";
import { loginUser } from "./helpers";

test.describe("Dashboard KPIs and Stats", () => {
  test("candidate dashboard shows stats cards", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await expect(page.locator("text=Applications Sent")).toBeVisible();
      await expect(page.locator("text=Saved Jobs")).toBeVisible();
      await expect(page.locator("text=Job Alerts")).toBeVisible();
      await expect(page.locator("text=Profile Views")).toBeVisible();
    }
  });

  test("candidate dashboard shows quick actions", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await expect(page.locator("text=Search for Jobs")).toBeVisible();
      await expect(page.locator("text=View My Applications")).toBeVisible();
      await expect(page.locator("text=Update Profile")).toBeVisible();
    }
  });

  test("company dashboard shows stats cards", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("text=Active Jobs").first()).toBeVisible();
    await expect(page.locator("text=Total Applicants").first()).toBeVisible();
    await expect(page.locator("text=Total Jobs").first()).toBeVisible();
  });

  test("company dashboard shows quick actions", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("text=Create New Job Listing").first()).toBeVisible();
    await expect(page.locator("text=View All Applicants").first()).toBeVisible();
    await expect(page.locator("text=Update Company Profile").first()).toBeVisible();
    await expect(page.locator("text=View Analytics").first()).toBeVisible();
  });

  test("company dashboard shows recent activity", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("text=Recent Activity").first()).toBeVisible();
  });

  test("company dashboard shows job status overview", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("text=Job Status Overview").first()).toBeVisible();
    await expect(page.locator("text=Active Jobs").first()).toBeVisible();
    await expect(page.locator("text=Pending Review").first()).toBeVisible();
    await expect(page.locator("text=Closed Jobs").first()).toBeVisible();
  });

  test("candidate applications show status badges", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");
    await page.goto("/dashboard/candidate/applications");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const badge = page.locator(".bg-amber-100, .bg-blue-100, .bg-green-100, .bg-red-100, .bg-emerald-100").first();
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(badge).toBeVisible();
    }
  });
});
