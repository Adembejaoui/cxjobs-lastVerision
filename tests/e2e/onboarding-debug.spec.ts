import { test, expect } from "@playwright/test";
import { registerUser, completeCandidateOnboarding } from "./helpers";

test("debug helper with API intercept", async ({ page }) => {
  const email = `debug-helper2-${Date.now()}@test.com`;
  const password = "TestPass@123";
  const name = "Debug Helper2";

  await page.route("**/api/profile", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    console.log("API /api/profile status:", response.status());
    console.log("API /api/profile body:", body.substring(0, 500));
    await route.fulfill({ response });
  });

  await registerUser(page, email, password, name);

  // Manually run the onboarding flow with logging
  await page.goto("/onboarding/candidate");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const stepBtn = () => page.locator("div.flex.justify-between.mt-6.pt-6.border-t.border-gray-200").locator("button").last();

  await page.click("text=I'll fill it manually");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await page.fill('input[placeholder="John"]', "Test");
  await page.fill('input[placeholder="Doe"]', "Candidate");
  await page.fill('input[placeholder="+216 00 000 000"]', "+216 00 000 000");
  await page.fill('input[placeholder="Tunis, Tunisia"]', "Tunis, Tunisia");
  await page.selectOption("select", { value: "male" });
  await page.waitForTimeout(300);
  console.log("Step 1 URL:", page.url());
  await stepBtn().click();
  await page.waitForTimeout(1500);

  await page.locator("button", { hasText: "Customer Service" }).first().click();
  await page.waitForTimeout(500);
  console.log("Step 2 URL:", page.url());
  await stepBtn().click();
  await page.waitForTimeout(1500);

  await page.fill('input[placeholder="e.g., Communication, French"]', "Customer Service");
  await page.click("text=Add");
  await page.waitForTimeout(500);
  console.log("Step 3 URL:", page.url());
  await stepBtn().click();
  await page.waitForTimeout(1500);

  await stepBtn().click();
  await page.waitForTimeout(1500);
  await stepBtn().click();
  await page.waitForTimeout(1500);
  await stepBtn().click();
  await page.waitForTimeout(1500);
  console.log("Step 7 URL:", page.url());
  console.log("Button text:", await stepBtn().innerText());

  await page.locator("button", { hasText: "Remote" }).first().click();
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: "Day Shift" }).first().click();
  await page.waitForTimeout(300);

  console.log("Button after selects:", await stepBtn().innerText());
  await stepBtn().click();
  await page.waitForTimeout(3000);
  console.log("URL after save:", page.url());
  console.log("Error:", await page.locator(".bg-red-50").count());
  if (await page.locator(".bg-red-50").count() > 0) {
    console.log("Error text:", await page.locator(".bg-red-50").innerText());
  }
});
