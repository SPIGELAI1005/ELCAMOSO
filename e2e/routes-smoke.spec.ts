import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

const ROUTES: { path: string; signal: RegExp }[] = [
  { path: "/", signal: /Your EV/i },
  { path: "/demo", signal: /Demo Drive/i },
  { path: "/drive", signal: /Start Drive|Stop Drive|Cockpit/i },
  { path: "/sounds", signal: /Choose your sound/i },
  { path: "/studio", signal: /Design a sound/i },
  { path: "/garage", signal: /Your sounds/i },
  { path: "/settings", signal: /Settings/i },
  { path: "/about", signal: /Your EV\. Your sound/i },
  { path: "/calibrate", signal: /Calibrate motion/i },
  { path: "/onboarding", signal: /Your EV|Driving sensors|Hear the difference|You're set|You.re set/i },
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
});
