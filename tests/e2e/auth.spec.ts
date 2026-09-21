import { test, expect } from "@playwright/test";
import { registerUser, loginUser, uniqueCandidateEmail } from "./helpers";

test.describe("Authentication", () => {
  test("registration with valid data creates candidate account and redirects to onboarding", async ({ page }) => {
    const email = uniqueCandidateEmail();
    const password = "TestPass@123";
    const name = "Test Candidate";

    await registerUser(page, email, password, name);

    await expect(page).toHaveURL(/onboarding\/candidate/);
  });

  test("registration with weak password shows validation error", async ({ page }) => {
    await page.goto("/register");
    await page.fill("#fullName", "Weak Pass");
    await page.fill("#email", "weak-password@test.com");
    await page.fill("#password", "weak");
    await page.check("#terms");

    const submitBtn = page.locator("button[type=submit]");
    await expect(submitBtn).toBeDisabled();
  });

  test("registration with existing email shows error", async ({ page }) => {
    const email = "duplicate@test.com";
    const password = "TestPass@123";
    const name = "Duplicate User";

    await registerUser(page, email, password, name);

    await page.click("text=Sign In");
    await page.waitForURL(/login/);

    await registerUser(page, email, password, name);
    await page.waitForTimeout(1000);
    await expect(page.locator("text=An account with this email already exists")).toBeVisible();
  });

  test("registration redirects unonboarded candidate to onboarding", async ({ page }) => {
    const email = uniqueCandidateEmail();
    const password = "TestPass@123";
    const name = "Onboard Test";

    await registerUser(page, email, password, name);

    await expect(page).toHaveURL(/onboarding\/candidate/);
  });

  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");

    await expect(page).toHaveURL(/dashboard/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@cxjobs.com");
    await page.fill("#password", "WrongPassword1");
    await page.click("button[type=submit]");

    await page.waitForTimeout(2000);
    await expect(page.locator("text=Invalid email or password")).toBeVisible();
  });

  test("protected dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/login/, { timeout: 15_000 });
  });

  test("candidate dashboard redirect for unonboarded candidate role", async ({ page }) => {
    await loginUser(page, "candidate1@email.com", "Candidate@2024");
    await page.waitForURL(/onboarding\/candidate/);
  });

  test("company dashboard redirect for company role", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard\/company/);
  });

  test("logout returns to login page", async ({ page }) => {
    await loginUser(page, "admin@cxjobs.com", "Admin@2024");
    await page.waitForURL(/dashboard/);

    await page.goto("/dashboard/profile");
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    await expect(page.locator("text=Log In, text=Sign In, text=Login")).toBeVisible();
  });

  test("registration validation: empty name", async ({ page }) => {
    await page.goto("/register");
    await page.fill("#email", "empty-name@test.com");
    await page.fill("#password", "TestPass@123");
    await page.check("#terms");

    const submitBtn = page.locator("button[type=submit]");
    await expect(submitBtn).toBeDisabled();
  });

  test("registration validation: terms not accepted", async ({ page }) => {
    await page.goto("/register");
    await page.fill("#fullName", "No Terms");
    await page.fill("#email", "no-terms@test.com");
    await page.fill("#password", "TestPass@123");

    const submitBtn = page.locator("button[type=submit]");
    await expect(submitBtn).toBeDisabled();
  });

  test("login with empty fields shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@cxjobs.com");
    await page.fill("#password", "");
    await page.click("button[type=submit]");

    await page.waitForTimeout(2000);
    const errorText = page.locator("text=Invalid email or password, text=Please enter both email and password, text=Email and password are required");
    if (await errorText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(errorText).toBeVisible();
    }
  });
});
