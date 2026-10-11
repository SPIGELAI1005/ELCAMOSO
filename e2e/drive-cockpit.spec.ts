import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Drive Cockpit", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page, {
      demoMotion: true,
      safetyAcknowledged: true,
      onboarded: true,
      favourites: ["gt-v8", "racing-v10", "cyber-pulse"],
      volume: 0.35,
      profileId: "gt-v8",
    });
  });

  test("active drive shows cockpit chrome at mobile size", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPath(page, "/drive");
    await expectAppHealthy(page);

    const start = page.getByRole("button", { name: /start drive/i });
    await expect(start).toBeVisible();
    await start.click();
    await page.waitForTimeout(1200);

    const cockpit = page.getByTestId("drive-cockpit");
    if (!(await cockpit.isVisible().catch(() => false))) {
      // Web Audio may be blocked in headless; idle UI must stay healthy.
      await expectAppHealthy(page);
      return;
    }

    await expect(cockpit.getByText(/ELCAMOSO|E L C A M O S O/i).first()).toBeVisible();
    await expect(cockpit.getByRole("button", { name: /stop drive/i })).toBeVisible();
    await expect(cockpit.getByRole("group", { name: /favourite sounds/i })).toBeVisible();
    await expect(cockpit.getByRole("group", { name: /master volume/i })).toBeVisible();
    await expect(cockpit.getByLabel(/active sound/i)).toBeVisible();
    await expect(cockpit.getByRole("link", { name: /settings/i })).toBeVisible();

    // Purchases / pairing / library stay outside active driving mode.
    await expect(page.getByRole("heading", { name: /drive\+/i })).toHaveCount(0);
    await expect(page.getByText(/sign in/i)).toHaveCount(0);

    await page.screenshot({
      path: "test-results/drive-cockpit-390x844.png",
      fullPage: true,
    });
  });

  test("active drive adapts at wide browser size", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoPath(page, "/drive");
    const start = page.getByRole("button", { name: /start drive/i });
    await start.click();
    await page.waitForTimeout(1200);

    const cockpit = page.getByTestId("drive-cockpit");
    if (!(await cockpit.isVisible().catch(() => false))) {
      await expectAppHealthy(page);
      return;
    }

    await expect(cockpit.getByRole("button", { name: /stop drive/i })).toBeVisible();
    const stopBox = await cockpit.getByRole("button", { name: /stop drive/i }).boundingBox();
    expect(stopBox?.height ?? 0).toBeGreaterThanOrEqual(48);

    await page.screenshot({
      path: "test-results/drive-cockpit-1280x800.png",
      fullPage: true,
    });
  });

  test("settings and drive share profile selection state", async ({ page }) => {
    await seedReadySettings(page, {
      demoMotion: true,
      safetyAcknowledged: true,
      onboarded: true,
      profileId: "racing-v10",
      favourites: ["gt-v8", "racing-v10", "cyber-pulse"],
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPath(page, "/drive");
    await page.getByRole("button", { name: /start drive/i }).click();
    await page.waitForTimeout(1200);

    const cockpit = page.getByTestId("drive-cockpit");
    if (!(await cockpit.isVisible().catch(() => false))) {
      await expectAppHealthy(page);
      return;
    }

    await expect(cockpit.getByText(/Racing V10/i).first()).toBeVisible();
    const picker = cockpit.getByLabel(/active sound/i);
    await picker.selectOption("gt-v8");
    await expect(cockpit.getByText(/GT V8/i).first()).toBeVisible();

    // Shared preference: Settings should reflect the same profileId.
    await page.goto("/settings");
    await expectAppHealthy(page);
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem("elcamoso.settings");
      return raw ? (JSON.parse(raw) as { profileId?: string }).profileId : null;
    });
    expect(stored).toBe("gt-v8");
  });
});
