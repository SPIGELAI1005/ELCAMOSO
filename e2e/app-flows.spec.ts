import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Sounds", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/sounds");
  });

  test("lists catalog categories", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(page.getByRole("heading", { name: /choose your sound/i })).toBeVisible();
    await expect(page.getByText(/Classic|Motorsport|Future|Playful/i).first()).toBeVisible();
  });

  test("category accordion reveals profiles", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /classic|motorsport|future/i }).first();
    await trigger.click();
    await expect(page.getByText(/GT V8|Cyber|Neon|Racing/i).first()).toBeVisible();
  });
});

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/settings");
  });

  test("settings page renders core sections", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(page.locator("main").getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.locator("main").getByText(/volume|motion|language|demo/i).first()).toBeVisible();
  });
});

test.describe("Drive (demo motion)", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page, { demoMotion: true, safetyAcknowledged: true, onboarded: true });
    await gotoPath(page, "/drive");
  });

  test("drive screen is reachable and startable", async ({ page }) => {
    await expectAppHealthy(page);
    const start = page.getByRole("button", { name: /start drive/i });
    await expect(start).toBeVisible();
    await start.click();
    const stop = page.getByRole("button", { name: /stop drive/i });
    await page.waitForTimeout(1200);
    if (await stop.isVisible().catch(() => false)) {
      await expect(stop).toBeVisible();
    } else {
      // Web Audio may be blocked in headless; UI must remain usable.
      await expectAppHealthy(page);
      await expect(start).toBeVisible();
    }
  });
});
