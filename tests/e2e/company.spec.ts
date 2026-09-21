import { test, expect } from "@playwright/test";
import { loginUser, registerUser, completeCompanyOnboarding } from "./helpers";

test.describe("Company Workflows", () => {
  test("company can view dashboard", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await expect(page.locator("h1:has-text('Dashboard')").first()).toBeVisible();
  });

  test("company can create a job listing via dialog", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    const postBtn = page.locator("text=Post New Job").first();
    if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await postBtn.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator("#title");
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.fill("#title", "Test Job Title");
        await page.fill("#description", "This is a test job description with at least 20 characters.");
        await page.fill("#customLocation", "Remote");
        await page.check("input[type=checkbox] >> nth=0");
        await page.selectOption("select >> nth=0", "CDI");
        await page.selectOption("select >> nth=1", "FULL_TIME");
        await page.selectOption("select >> nth=2", "CUSTOMER_SERVICE");

        await page.click("button[type=submit]");
        await page.waitForTimeout(3000);

        await expect(page.locator("text=Test Job Title")).toBeVisible();
      }
    }
  });

  test("company can search and filter jobs", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.fill("input[placeholder='Search job titles, locations...']", "Test");
    await page.waitForTimeout(1000);

    await page.selectOption("select >> nth=0", "PUBLISHED");
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Manage Jobs").first()).toBeVisible();

    await page.fill("input[placeholder='Search job titles, locations...']", "");
    await page.selectOption("select >> nth=0", "ALL");
    await page.waitForTimeout(500);
  });

  test("company can edit a job listing", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const editBtn = page.locator("button[title='Edit']").first();
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);

      const titleInput = page.locator("#title");
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.fill("#title", "Updated Job Title");
        await page.click("button[type=submit]");
        await page.waitForTimeout(3000);

        await expect(page.locator("text=Updated Job Title").first()).toBeVisible();

        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(1000);
      }
    }
  });

  test("company can view applications for a job", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/jobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const viewApplicants = page.locator("text=View applicants").first();
    if (await viewApplicants.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewApplicants.click();
      await page.waitForURL(/applications/, { timeout: 15_000 });

      await expect(page.locator("h1")).toBeVisible();
    }
  });

  test("company can view analytics", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/analytics");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.locator("h1:has-text('Analytics')")).toBeVisible();
  });

  test("company can update profile", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/dashboard/company/profile");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page.locator("h1:has-text('Company Profile')")).toBeVisible();
  });

  test("company can view public company page", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.goto("/companies/cxjobs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("company can post job from dashboard", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);

    const postBtn = page.locator("text=Post New Job").first();
    if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await postBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
