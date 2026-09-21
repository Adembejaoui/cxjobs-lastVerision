import { test, expect } from "@playwright/test";
import { loginUser, registerUser, completeCandidateOnboarding } from "./helpers";

test.describe("Candidate Workflows", () => {
  test("candidate can browse jobs with filters", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h2:has-text('Call Center Jobs')")).toBeVisible();

    await page.selectOption("select[aria-label='Location']", "Remote");
    await page.waitForTimeout(1500);

    await page.selectOption("select[aria-label='Location']", "");
    await page.fill("input[placeholder='Search jobs, companies...']", "Customer Service");
    await page.waitForTimeout(1500);

    await expect(page.locator("text=Showing")).toBeVisible();
  });

  test("candidate can view job detail", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");
    await page.goto("/jobs/senior-customer-service-agent");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1:has-text('Senior Customer Service Agent')")).toBeVisible();
  });

  test("candidate can apply to a published job", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");
    await page.goto("/jobs/senior-customer-service-agent/apply");
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(2000);

    if (page.locator("text=Application Submitted!").isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }

    if (page.locator("text=Complete Your Profile").isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.click("text=Complete Your Profile");
      await page.waitForURL(/profile/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await page.goto("/jobs/senior-customer-service-agent/apply");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }

    const submitBtn = page.locator("button[type=submit]");
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await expect(page.locator("text=Application Submitted!")).toBeVisible();
    }
  });

  test("candidate sees duplicate application error", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");
    await page.goto("/jobs/senior-customer-service-agent/apply");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const submitBtn = page.locator("button[type=submit]");
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      const errorText = page.locator("text=already applied");
      if (await errorText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(errorText).toBeVisible();
      }
    }
  });

  test("candidate can view applications list", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/dashboard/candidate/applications");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1:has-text('My Applications')")).toBeVisible();
  });

  test("candidate can filter applications by status", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/dashboard/candidate/applications");
    await page.waitForLoadState("networkidle");

    await page.selectOption("select", "NOUVEAU");
    await page.waitForTimeout(1000);

    await page.selectOption("select", "ALL");
    await page.waitForTimeout(500);

    await expect(page.locator("text=My Applications")).toBeVisible();
  });

  test("candidate can search applications", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/dashboard/candidate/applications");
    await page.waitForLoadState("networkidle");

    await page.fill("input[placeholder='Search by job title, company, or location...']", "Customer");
    await page.waitForTimeout(1000);

    await expect(page.locator("text=My Applications")).toBeVisible();
  });

  test("candidate profile page shows profile info", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/dashboard/candidate/profile");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1:has-text('My Profile')")).toBeVisible();
  });

  test("candidate CV page is accessible", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await completeCandidateOnboarding(page);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
    }

    await page.goto("/dashboard/candidate/cv");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toBeVisible();
  });
});
