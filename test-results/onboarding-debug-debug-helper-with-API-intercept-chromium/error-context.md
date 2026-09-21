# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-debug.spec.ts >> debug helper with API intercept
- Location: tests\e2e\onboarding-debug.spec.ts:4:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: 'Remote' }).first()

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - generic [ref=f1e4]:
      - generic [ref=f1e5]:
        - generic [ref=f1e6]: Step 4 of 7
        - generic [ref=f1e7]:
          - generic [ref=f1e8]: 👥
          - generic [ref=f1e9]: Customer Service
      - generic [ref=f1e10]:
        - generic [ref=f1e11]:
          - generic [ref=f1e12]: ✓
          - generic [ref=f1e15]: ✓
          - generic [ref=f1e18]: ✓
          - generic [ref=f1e21]: "4"
          - generic [ref=f1e24]: "5"
          - generic [ref=f1e27]: "6"
          - generic [ref=f1e30]: "7"
        - generic [ref=f1e32]:
          - heading "Languages" [level=2] [ref=f1e33]
          - paragraph [ref=f1e34]: Step 4 of 7
      - generic [ref=f1e37]:
        - generic [ref=f1e38]: Add Language
        - generic [ref=f1e39]:
          - combobox [ref=f1e40]:
            - option "Select a language" [selected]
            - option "Arabic"
            - option "Dutch"
            - option "English"
            - option "French"
            - option "Italian"
            - option "Portuguese"
            - option "Spanish"
            - option "Other"
          - combobox [ref=f1e41]:
            - option "Basic" [selected]
            - option "Conversational"
            - option "Fluent"
            - option "Native"
          - button "Add" [disabled] [ref=f1e42]
      - generic [ref=f1e43]:
        - button "Previous" [ref=f1e44]
        - button "Continue" [active] [ref=f1e45]
    - button "Or upload your CV instead →" [ref=f1e47]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=f1e53] [cursor=pointer]
  - alert [ref=f1e57]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { registerUser, completeCandidateOnboarding } from "./helpers";
  3  | 
  4  | test("debug helper with API intercept", async ({ page }) => {
  5  |   const email = `debug-helper2-${Date.now()}@test.com`;
  6  |   const password = "TestPass@123";
  7  |   const name = "Debug Helper2";
  8  | 
  9  |   await page.route("**/api/profile", async (route) => {
  10 |     const response = await route.fetch();
  11 |     const body = await response.text();
  12 |     console.log("API /api/profile status:", response.status());
  13 |     console.log("API /api/profile body:", body.substring(0, 500));
  14 |     await route.fulfill({ response });
  15 |   });
  16 | 
  17 |   await registerUser(page, email, password, name);
  18 | 
  19 |   // Manually run the onboarding flow with logging
  20 |   await page.goto("/onboarding/candidate");
  21 |   await page.waitForLoadState("networkidle");
  22 |   await page.waitForTimeout(1000);
  23 | 
  24 |   const stepBtn = () => page.locator("div.flex.justify-between.mt-6.pt-6.border-t.border-gray-200").locator("button").last();
  25 | 
  26 |   await page.click("text=I'll fill it manually");
  27 |   await page.waitForLoadState("networkidle");
  28 |   await page.waitForTimeout(1500);
  29 | 
  30 |   await page.fill('input[placeholder="John"]', "Test");
  31 |   await page.fill('input[placeholder="Doe"]', "Candidate");
  32 |   await page.fill('input[placeholder="+216 00 000 000"]', "+216 00 000 000");
  33 |   await page.fill('input[placeholder="Tunis, Tunisia"]', "Tunis, Tunisia");
  34 |   await page.selectOption("select", { value: "male" });
  35 |   await page.waitForTimeout(300);
  36 |   console.log("Step 1 URL:", page.url());
  37 |   await stepBtn().click();
  38 |   await page.waitForTimeout(1500);
  39 | 
  40 |   await page.locator("button", { hasText: "Customer Service" }).first().click();
  41 |   await page.waitForTimeout(500);
  42 |   console.log("Step 2 URL:", page.url());
  43 |   await stepBtn().click();
  44 |   await page.waitForTimeout(1500);
  45 | 
  46 |   await page.fill('input[placeholder="e.g., Communication, French"]', "Customer Service");
  47 |   await page.click("text=Add");
  48 |   await page.waitForTimeout(500);
  49 |   console.log("Step 3 URL:", page.url());
  50 |   await stepBtn().click();
  51 |   await page.waitForTimeout(1500);
  52 | 
  53 |   await stepBtn().click();
  54 |   await page.waitForTimeout(1500);
  55 |   await stepBtn().click();
  56 |   await page.waitForTimeout(1500);
  57 |   await stepBtn().click();
  58 |   await page.waitForTimeout(1500);
  59 |   console.log("Step 7 URL:", page.url());
  60 |   console.log("Button text:", await stepBtn().innerText());
  61 | 
> 62 |   await page.locator("button", { hasText: "Remote" }).first().click();
     |                                                               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  63 |   await page.waitForTimeout(300);
  64 |   await page.locator("button", { hasText: "Day Shift" }).first().click();
  65 |   await page.waitForTimeout(300);
  66 | 
  67 |   console.log("Button after selects:", await stepBtn().innerText());
  68 |   await stepBtn().click();
  69 |   await page.waitForTimeout(3000);
  70 |   console.log("URL after save:", page.url());
  71 |   console.log("Error:", await page.locator(".bg-red-50").count());
  72 |   if (await page.locator(".bg-red-50").count() > 0) {
  73 |     console.log("Error text:", await page.locator(".bg-red-50").innerText());
  74 |   }
  75 | });
  76 | 
```