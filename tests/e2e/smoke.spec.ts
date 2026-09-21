import { test } from "@playwright/test";

test.describe("Auth - Smoke", () => {
  test("login admin", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#email", "admin@cxjobs.com");
    await page.fill("#password", "Admin@2024");
    await page.click("button[type=submit]");
    await page.waitForURL(/dashboard/, { timeout: 20_000 });
    console.log("LOGIN_REDIRECT_OK", page.url());
  });
});
