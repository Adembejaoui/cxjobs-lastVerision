import { test, expect } from "@playwright/test";
import { registerUser, loginUser, completeCandidateOnboarding, completeCompanyOnboarding } from "./helpers";

test.describe("Onboarding Completion", () => {
  test("candidate registration redirects to onboarding", async ({ page }) => {
    const email = `onboard-candidate-${Date.now()}@test.com`;
    const password = "TestPass@123";
    const name = "Onboard Candidate";

    await registerUser(page, email, password, name);

    await expect(page).toHaveURL(/onboarding\/candidate/);
  });

  test("candidate completes manual onboarding and accesses dashboard", async ({ page }) => {
    const email = `onboard-candidate-${Date.now()}@test.com`;
    const password = "TestPass@123";
    const name = "Onboard Candidate";

    await registerUser(page, email, password, name);
    await expect(page).toHaveURL(/onboarding\/candidate/);

    await completeCandidateOnboarding(page);

    await expect(page.locator("text=My Profile")).toBeVisible();
  });

  test("company onboarding redirect works for unonboarded user", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard/);

    await page.goto("/onboarding/company");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/dashboard/);
  });

  test("onboarding redirect is applied based on user role", async ({ page }) => {
    const email = `role-onboard-${Date.now()}@test.com`;
    const password = "TestPass@123";
    const name = "Role Onboard Test";

    await registerUser(page, email, password, name);

    await expect(page).toHaveURL(/onboarding\/candidate/);

    await page.goto("/onboarding/company");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Set Up Your Company")).toBeVisible();
  });
});
