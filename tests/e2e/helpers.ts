import { Page } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: "CANDIDATE" | "COMPANY" | "ADMIN";
}

let candidateCount = 0;
let companyCount = 0;

export function uniqueCandidateEmail(): string {
  candidateCount++;
  return `test-candidate-${candidateCount}@test.com`;
}

export function uniqueCompanyEmail(): string {
  companyCount++;
  return `test-company-${companyCount}@test.com`;
}

export async function registerUser(page: Page, email: string, password: string, name: string): Promise<void> {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.fill("#fullName", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.check("#terms");
  await page.click("button[type=submit]");
  await page.waitForURL("**/onboarding/**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => url.pathname.startsWith("/onboarding") || url.pathname.startsWith("/dashboard"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

export async function logoutUser(page: Page): Promise<void> {
  await page.click("[data-testid='user-menu']");
  await page.waitForTimeout(500);
  await page.click("[data-testid='logout-button']");
  await page.waitForURL(/login/, { timeout: 15_000 });
}

export async function apiRegister(email: string, password: string, name: string, role: string = "CANDIDATE"): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role }),
  });
  return res.json();
}

export async function apiLogin(email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch("/api/auth/[...nextauth]", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function apiCreateJobOffer(
  accessToken: string,
  jobData: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const res = await fetch("/api/job-offers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(jobData),
  });
  return res.json();
}

export async function completeCandidateOnboarding(page: Page): Promise<void> {
  await page.goto("/onboarding/candidate");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  if (await page.locator("text=My Profile").isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.waitForURL("**/dashboard/**", { timeout: 15000 });
    return;
  }

  await page.click("text=I'll fill it manually");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const stepBtn = () => page.locator("div.flex.justify-between.mt-6.pt-6.border-t.border-gray-200").locator("button").last();

  await page.fill('input[placeholder="John"]', "Test");
  await page.fill('input[placeholder="Doe"]', "Candidate");
  await page.fill('input[placeholder="+216 00 000 000"]', "+216 00 000 000");
  await page.fill('input[placeholder="Tunis, Tunisia"]', "Tunis, Tunisia");
  await page.selectOption("select", { value: "male" });
  await page.waitForTimeout(300);
  await stepBtn().click();
  await page.waitForTimeout(1500);

  const roleBtn = page.locator("button", { hasText: "Customer Service" }).first();
  if (await roleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await roleBtn.click();
  }
  await page.waitForTimeout(500);
  await stepBtn().click();
  await page.waitForTimeout(1500);

  await page.fill('input[placeholder="e.g., Communication, French"]', "Customer Service");
  await page.click("text=Add");
  await page.waitForTimeout(500);
  await stepBtn().click();
  await page.waitForTimeout(1500);

  await stepBtn().click();
  await page.waitForTimeout(1500);

  await stepBtn().click();
  await page.waitForTimeout(1500);

  await stepBtn().click();
  await page.waitForTimeout(1500);

  const remoteBtn = page.locator("button", { hasText: "Remote" }).first();
  if (await remoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await remoteBtn.click();
  }
  await page.waitForTimeout(300);

  const shiftBtn = page.locator("button", { hasText: "Day Shift" }).first();
  if (await shiftBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await shiftBtn.click();
  }
  await page.waitForTimeout(300);

  const completeBtn = page.locator("text=Complete Profile");
  console.log("DEBUG: completeBtn visible:", await completeBtn.isVisible({ timeout: 5000 }).catch(() => false));
  console.log("DEBUG: stepBtn text:", await stepBtn().innerText());
  if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await completeBtn.click();
    console.log("DEBUG: clicked Complete Profile");
  } else {
    console.log("DEBUG: clicked Continue (fallback)");
    await stepBtn().click();
  }
  await page.waitForTimeout(8000);
  console.log("DEBUG: URL after save:", page.url());

  await page.waitForURL("**/dashboard/candidate/**", { timeout: 15000 });
}

export async function completeCompanyOnboarding(page: Page): Promise<void> {
  await page.goto("/onboarding/company");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.fill('input[placeholder="e.g., Tech Solutions Tunisia"]', "Test Company");
  await page.fill('input[placeholder="e.g., tech-solutions-tunisia"]', "test-company");
  await page.fill('textarea[placeholder="Tell candidates about your company..."]', "A test company for E2E testing");
  await page.selectOption("select >> nth=0", "Technology");
  await page.selectOption("select >> nth=1", "STARTUP");
  await page.fill('input[placeholder="e.g., Tunis, Tunisia"]', "Tunis, Tunisia");
  await page.waitForTimeout(500);
  await page.click("button[type=submit]");
  await page.waitForURL(/dashboard/, { timeout: 15_000 });
}
