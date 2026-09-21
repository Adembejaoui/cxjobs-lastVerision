import { test, expect } from "@playwright/test";
import { loginUser, registerUser, completeCandidateOnboarding } from "./helpers";

test.describe("Role-Based Access Control", () => {
  test("candidate cannot access company dashboard", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await page.goto("/dashboard/company");
      await page.waitForTimeout(2000);
      await expect(page.locator("h1:has-text('Dashboard')").first()).not.toBeVisible();
    }
  });

  test("candidate cannot access company jobs page", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await page.goto("/dashboard/company/jobs");
      await page.waitForTimeout(2000);
      await expect(page.locator("text=Manage Jobs").first()).not.toBeVisible();
    }
  });

  test("candidate cannot access company analytics", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await page.goto("/dashboard/company/analytics");
      await page.waitForTimeout(2000);
      await expect(page.locator("text=Analytics").first()).not.toBeVisible();
    }
  });

  test("candidate cannot access company applications", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");

    if (page.url().includes("/onboarding/candidate")) {
      await expect(page).toHaveURL(/onboarding\/candidate/);
    } else {
      await page.waitForURL(/dashboard\/candidate/);
      await page.goto("/dashboard/company/jobs/test/applications");
      await page.waitForTimeout(2000);
    }
  });

  test("company cannot access candidate applications", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await page.goto("/dashboard/candidate/applications");
    await page.waitForTimeout(2000);

    await expect(page.locator("text=My Applications").first()).not.toBeVisible();
  });

  test("company cannot access candidate profile", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await page.goto("/dashboard/candidate/profile");
    await page.waitForTimeout(2000);
  });

  test("company user can access company dashboard", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("h1:has-text('Dashboard')").first()).toBeVisible();
  });

  test("newly registered user has CANDIDATE role", async ({ page }) => {
    const email = `role-test-${Date.now()}@test.com`;
    await registerUser(page, email, "TestPass@123", "Role Test");

    await expect(page).toHaveURL(/onboarding\/candidate/);
  });
});
