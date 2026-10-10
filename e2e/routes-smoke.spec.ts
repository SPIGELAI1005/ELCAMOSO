import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

const ROUTES: { path: string; signal: RegExp }[] = [
  { path: "/", signal: /Your EV/i },
  { path: "/demo", signal: /Feel the Drive/i },
  { path: "/drive", signal: /Start Drive|Stop Drive|Sound Active|No motion yet/i },
  { path: "/explore", signal: /Choose what motion becomes/i },
  { path: "/sounds", signal: /Choose your sound/i },
  { path: "/symphony", signal: /Your driving becomes the arrangement/i },
  { path: "/worlds", signal: /Drive somewhere impossible/i },
  { path: "/fusion", signal: /Motion has more than one voice/i },
  { path: "/studio", signal: /Make it yours/i },
  { path: "/garage", signal: /My Garage/i },
  { path: "/journeys", signal: /Every drive creates a different song/i },
  { path: "/pricing", signal: /Make every drive yours/i },
  { path: "/settings", signal: /Settings/i },
  { path: "/story", signal: /Your EV\. Your sound/i },
  { path: "/calibrate", signal: /Calibrate motion/i },
  { path: "/onboarding", signal: /Your EV\. Your Sound|Location|Motion|Before you drive|Start/i },
  { path: "/legal", signal: /Legal/i },
  { path: "/legal/impressum", signal: /Legal Notice/i },
  { path: "/legal/privacy", signal: /Privacy/i },
  { path: "/legal/cookies", signal: /Cookie/i },
  { path: "/legal/terms", signal: /Term/i },
  { path: "/legal/accessibility", signal: /Accessibility/i },
];

test.describe("Route smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
  });

  for (const route of ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await gotoPath(page, route.path);
      await expectAppHealthy(page);
      await expect(page.locator("body")).toContainText(route.signal);
    });
  }

  test("Story begins with the origin story before live-or-later positioning", async ({ page }) => {
    await gotoPath(page, "/story");
    const text = (await page.locator("main").innerText()).toLocaleLowerCase();
    expect(text.indexOf("where it started")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("where it started")).toBeLessThan(text.indexOf("sound when you want it"));
  });

  test("legacy /about redirects to Story", async ({ page }) => {
    await gotoPath(page, "/about");
    await expect(page).toHaveURL(/\/story\/?$/);
  });

  test("World cards do not show decorative gradient placeholders", async ({ page }) => {
    await gotoPath(page, "/worlds");
    await expect(page.locator("main [class*='bg-gradient']")).toHaveCount(0);
    await expect(page.getByLabel(/Reactive energy/i)).toHaveCount(0);
  });
});
