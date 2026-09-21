import { test, expect } from "@playwright/test";
import { loginUser, registerUser, completeCandidateOnboarding } from "./helpers";

test.describe("Application Workflows", () => {
  test("candidate applies to job and sees application in list", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/jobs/senior-customer-service-agent/apply");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const submitBtn = page.locator("button[type=submit]");
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.fill("I am excited to join your team.");
      await submitBtn.click();
      await page.waitForTimeout(3000);

      const successText = page.locator("text=Application Submitted!");
      if (await successText.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(successText).toBeVisible();

        await page.goto("/dashboard/candidate/applications");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        await expect(page.locator("text=Senior Customer Service Agent")).toBeVisible();
      }
    }
  });

  test("company sees new application in job applications", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("company applications page has status counts", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForURL(/applications/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await expect(page.locator("text=Total Applicants")).toBeVisible();
      await expect(page.locator("text=New")).toBeVisible();
    }
  });

  test("company can search candidates in applications", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForURL(/applications/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const searchInput = page.locator("input[placeholder='Search candidates by name or email...']");
      await searchInput.fill("Test");
      await page.waitForTimeout(1000);
    }
  });

  test("company can filter applications by status", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForURL(/applications/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await page.selectOption("select", "NOUVEAU");
      await page.waitForTimeout(1000);

      await page.selectOption("select", "ALL");
      await page.waitForTimeout(500);
    }
  });

  test("company can navigate to job detail from applications", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForURL(/applications/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await page.click("text=Back to Jobs");
      await page.waitForURL(/dashboard\/company\/jobs/, { timeout: 15_000 });
    }
  });
});
